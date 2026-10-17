import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

import { InvalidRecipeImportUrlError, RecipeImportParseError } from './errors.ts';

const MAX_REDIRECTS = 5;
/** Per-hop deadline for recipe HTML fetch (connect + response body). */
export const RECIPE_IMPORT_FETCH_TIMEOUT_MS = 10_000;

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

const blockedHostnames = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
]);

const blockedHostnameSuffixes = ['.localhost', '.local', '.internal'];

const blockedAddresses = new BlockList();

blockedAddresses.addSubnet('0.0.0.0', 8, 'ipv4');
blockedAddresses.addSubnet('10.0.0.0', 8, 'ipv4');
blockedAddresses.addSubnet('100.64.0.0', 10, 'ipv4');
blockedAddresses.addSubnet('127.0.0.0', 8, 'ipv4');
blockedAddresses.addSubnet('169.254.0.0', 16, 'ipv4');
blockedAddresses.addSubnet('172.16.0.0', 12, 'ipv4');
blockedAddresses.addSubnet('192.0.0.0', 24, 'ipv4');
blockedAddresses.addSubnet('192.0.2.0', 24, 'ipv4');
blockedAddresses.addSubnet('192.168.0.0', 16, 'ipv4');
blockedAddresses.addSubnet('198.18.0.0', 15, 'ipv4');
blockedAddresses.addSubnet('198.51.100.0', 24, 'ipv4');
blockedAddresses.addSubnet('203.0.113.0', 24, 'ipv4');
blockedAddresses.addSubnet('224.0.0.0', 4, 'ipv4');
blockedAddresses.addSubnet('240.0.0.0', 4, 'ipv4');
blockedAddresses.addAddress('::', 'ipv6');
blockedAddresses.addAddress('::1', 'ipv6');
blockedAddresses.addSubnet('fc00::', 7, 'ipv6');
blockedAddresses.addSubnet('fe80::', 10, 'ipv6');
blockedAddresses.addSubnet('ff00::', 8, 'ipv6');
blockedAddresses.addSubnet('2001:db8::', 32, 'ipv6');

export interface ResolvedAddress {
  address: string;
  family: number;
}

export interface DnsLookup {
  (hostname: string): Promise<ResolvedAddress[]>;
}

const lookupPublicHost: DnsLookup = async (hostname) => lookup(hostname, { all: true });

const normalizeHostname = (hostname: string): string => hostname.toLowerCase().replace(/\.+$/, '');

const literalAddress = (hostname: string): string | null => {
  const bare = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  return isIP(bare) ? bare : null;
};

const isBlockedHostname = (hostname: string): boolean => {
  if (blockedHostnames.has(hostname)) {
    return true;
  }

  return blockedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix));
};

const isBlockedAddress = (address: string): boolean => {
  const family = isIP(address);

  if (family === 4) {
    return blockedAddresses.check(address, 'ipv4');
  }

  if (family === 6) {
    return blockedAddresses.check(address, 'ipv6');
  }

  return true;
};

const pickPinnedAddress = (addresses: ResolvedAddress[]): ResolvedAddress => {
  return addresses.find((entry) => entry.family === 4) ?? addresses[0];
};

/**
 * Validate the URL and return DNS addresses that are all public.
 * Callers must connect only to one of these addresses (DNS pinning).
 */
export const resolvePublicHttpUrl = async (
  url: URL,
  lookupImpl: DnsLookup = lookupPublicHost
): Promise<ResolvedAddress[]> => {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new InvalidRecipeImportUrlError();
  }

  const hostname = normalizeHostname(url.hostname);

  if (!hostname || isBlockedHostname(hostname)) {
    throw new InvalidRecipeImportUrlError();
  }

  const address = literalAddress(hostname);

  if (address) {
    if (isBlockedAddress(address)) {
      throw new InvalidRecipeImportUrlError();
    }

    return [{ address, family: isIP(address) }];
  }

  let addresses: ResolvedAddress[];

  try {
    addresses = await lookupImpl(hostname);
  } catch {
    throw new InvalidRecipeImportUrlError();
  }

  if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new InvalidRecipeImportUrlError();
  }

  return addresses;
};

export const assertPublicHttpUrl = async (
  url: URL,
  lookupImpl: DnsLookup = lookupPublicHost
): Promise<void> => {
  await resolvePublicHttpUrl(url, lookupImpl);
};

const discardBody = async (response: Response): Promise<void> => {
  try {
    await response.body?.cancel?.();
  } catch {
    // The redirect body is unused.
  }
};

const isFetchTimeoutError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'TimeoutError' ||
    error.name === 'AbortError' ||
    /timed out/i.test(error.message)
  );
};

/**
 * Connect to a pre-validated IP while sending the original Host / SNI name.
 * Prevents DNS rebinding between the public-IP check and the TCP connect.
 */
export const fetchPinnedHttpUrl = (
  url: URL,
  pinned: ResolvedAddress,
  headers: Record<string, string>,
  timeoutMs: number = RECIPE_IMPORT_FETCH_TIMEOUT_MS
): Promise<Response> => {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;
    const port = url.port ? Number(url.port) : isHttps ? 443 : 80;
    let settled = false;

    const fail = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: pinned.address,
        port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          ...headers,
          Host: url.host,
        },
        servername: isHttps ? url.hostname : undefined,
        family: pinned.family === 6 ? 6 : 4,
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        incoming.on('end', () => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);

          const headerInit: Record<string, string> = {};
          for (const [key, value] of Object.entries(incoming.headers)) {
            if (value === undefined) {
              continue;
            }
            headerInit[key] = Array.isArray(value) ? value.join(', ') : value;
          }

          resolve(
            new Response(Buffer.concat(chunks), {
              status: incoming.statusCode ?? 0,
              statusText: incoming.statusMessage,
              headers: headerInit,
            })
          );
        });
        incoming.on('error', (error) => {
          clearTimeout(timer);
          fail(error);
        });
      }
    );

    const timer = setTimeout(() => {
      request.destroy();
      fail(new Error('Recipe import fetch timed out'));
    }, timeoutMs);

    request.on('error', (error) => {
      clearTimeout(timer);
      fail(error);
    });
    request.end();
  });
};

const defaultImportHeaders = {
  'User-Agent': 'MealDiaryRecipeImporter/1.0',
  Accept: 'text/html,application/xhtml+xml',
};

/** Injectable fetch that must connect only to the pre-validated pinned address. */
export type PinnedHttpFetch = (
  url: URL,
  pinned: ResolvedAddress,
  headers: Record<string, string>,
  timeoutMs?: number
) => Promise<Response>;

/**
 * Fetch HTML after resolving every hop to a public IP and connecting only to
 * that pinned address (never re-resolve the hostname via global fetch).
 */
export const fetchPublicHtml = async (
  url: URL,
  pinnedFetch: PinnedHttpFetch = fetchPinnedHttpUrl,
  lookupImpl?: DnsLookup
): Promise<Response> => {
  const resolveHost = lookupImpl ?? lookupPublicHost;
  let current = url;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const addresses = await resolvePublicHttpUrl(current, resolveHost);
    const pinned = pickPinnedAddress(addresses);

    try {
      const response = await pinnedFetch(current, pinned, defaultImportHeaders);

      if (!redirectStatuses.has(response.status)) {
        return response;
      }

      await discardBody(response);

      if (redirectCount === MAX_REDIRECTS) {
        throw new InvalidRecipeImportUrlError();
      }

      const location = response.headers.get('location');

      if (!location) {
        throw new InvalidRecipeImportUrlError();
      }

      try {
        current = new URL(location, current);
      } catch {
        throw new InvalidRecipeImportUrlError();
      }
    } catch (error) {
      if (error instanceof InvalidRecipeImportUrlError || error instanceof RecipeImportParseError) {
        throw error;
      }

      if (isFetchTimeoutError(error)) {
        throw new RecipeImportParseError('Recipe import timed out');
      }

      throw error;
    }
  }

  throw new InvalidRecipeImportUrlError();
};
