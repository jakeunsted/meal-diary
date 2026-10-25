import { EventEmitter } from 'node:events';
import { describe, it, expect, vi } from 'vitest';
import { InvalidRecipeImportUrlError, RecipeImportParseError } from '../errors.ts';

const httpRequest = vi.hoisted(() => vi.fn());

vi.mock('node:http', () => ({
  default: {
    request: httpRequest,
  },
  request: httpRequest,
}));

import {
  assertPublicHttpUrl,
  resolvePublicHttpUrl,
  fetchPublicHtml,
  fetchPinnedHttpUrl,
  RECIPE_IMPORT_FETCH_TIMEOUT_MS,
  RECIPE_IMPORT_MAX_BYTES,
  type PinnedHttpFetch,
  type ResolvedAddress,
} from '../publicUrl.ts';

describe('resolvePublicHttpUrl / assertPublicHttpUrl', () => {
  it('rejects private and metadata hostnames', async () => {
    await expect(assertPublicHttpUrl(new URL('http://localhost/recipe'))).rejects.toBeInstanceOf(
      InvalidRecipeImportUrlError
    );
    await expect(
      assertPublicHttpUrl(new URL('http://169.254.169.254/latest/meta-data/'))
    ).rejects.toBeInstanceOf(InvalidRecipeImportUrlError);
    await expect(assertPublicHttpUrl(new URL('http://192.168.1.1/'))).rejects.toBeInstanceOf(
      InvalidRecipeImportUrlError
    );
  });

  it('rejects credentials in the URL', async () => {
    await expect(
      assertPublicHttpUrl(new URL('https://user:pass@example.com/recipe'))
    ).rejects.toBeInstanceOf(InvalidRecipeImportUrlError);
  });

  it('rejects when DNS returns any private address', async () => {
    const lookup = vi.fn().mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);

    await expect(
      resolvePublicHttpUrl(new URL('https://example.com/recipe'), lookup)
    ).rejects.toBeInstanceOf(InvalidRecipeImportUrlError);
  });

  it('returns only public addresses for pinning', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

    const addresses = await resolvePublicHttpUrl(new URL('https://example.com/recipe'), lookup);
    expect(addresses).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });
});

describe('fetchPublicHtml', () => {
  it('re-validates each redirect hop before fetching', async () => {
    const lookup = vi
      .fn()
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '10.0.0.1', family: 4 }]);

    const pinnedFetch = vi.fn<PinnedHttpFetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://evil.internal/recipe' },
      })
    );

    await expect(
      fetchPublicHtml(new URL('https://example.com/recipe'), pinnedFetch, lookup)
    ).rejects.toBeInstanceOf(InvalidRecipeImportUrlError);

    expect(pinnedFetch).toHaveBeenCalledTimes(1);
    expect(pinnedFetch).toHaveBeenCalledWith(
      new URL('https://example.com/recipe'),
      { address: '93.184.216.34', family: 4 },
      expect.any(Object)
    );
  });

  it('passes the pinned public address into the fetch implementation', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const pinnedFetch = vi
      .fn<PinnedHttpFetch>()
      .mockResolvedValue(new Response('<html></html>', { status: 200 }));

    await fetchPublicHtml(new URL('https://example.com/recipe'), pinnedFetch, lookup);

    expect(pinnedFetch).toHaveBeenCalledWith(
      new URL('https://example.com/recipe'),
      { address: '93.184.216.34', family: 4 } satisfies ResolvedAddress,
      expect.objectContaining({
        'User-Agent': 'MealDiaryRecipeImporter/1.0',
      })
    );
    expect(RECIPE_IMPORT_FETCH_TIMEOUT_MS).toBe(10_000);
  });

  it('maps fetch timeout errors to RecipeImportParseError', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    const pinnedFetch = vi.fn<PinnedHttpFetch>().mockRejectedValue(timeoutError);

    await expect(
      fetchPublicHtml(new URL('https://example.com/recipe'), pinnedFetch, lookup)
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof RecipeImportParseError && error.message === 'Recipe import timed out'
    );
  });
});

describe('fetchPinnedHttpUrl body cap', () => {
  const pinned: ResolvedAddress = { address: '93.184.216.34', family: 4 };
  const recipeUrl = new URL('http://example.com/recipe');

  const fakeIncoming = (headers: Record<string, string | string[]>, statusCode = 200) => {
    const incoming = new EventEmitter() as EventEmitter & {
      headers: Record<string, string | string[]>;
      statusCode: number;
      statusMessage: string;
      destroy: ReturnType<typeof vi.fn>;
    };
    incoming.headers = headers;
    incoming.statusCode = statusCode;
    incoming.statusMessage = 'OK';
    incoming.destroy = vi.fn();
    return incoming;
  };

  const installRequest = (
    incoming: ReturnType<typeof fakeIncoming>,
    write: (incoming: ReturnType<typeof fakeIncoming>) => void
  ) => {
    const clientRequest = new EventEmitter() as EventEmitter & {
      destroy: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
    };
    clientRequest.destroy = vi.fn();
    clientRequest.end = vi.fn();
    httpRequest.mockImplementation((_options: unknown, callback: (response: EventEmitter) => void) => {
      process.nextTick(() => {
        callback(incoming);
        write(incoming);
      });
      return clientRequest;
    });
    return clientRequest;
  };

  it('returns a body that stays within 1 MiB', async () => {
    const incoming = fakeIncoming({});
    const body = Buffer.from('<html>ok</html>');
    installRequest(incoming, (response) => {
      response.emit('data', body);
      response.emit('end');
    });

    const response = await fetchPinnedHttpUrl(recipeUrl, pinned, { Accept: 'text/html' });

    expect(await response.text()).toBe('<html>ok</html>');
    expect(RECIPE_IMPORT_MAX_BYTES).toBe(1024 * 1024);
  });

  it('destroys the socket when a fixture writes past 1 MiB', async () => {
    const incoming = fakeIncoming({});
    const clientRequest = installRequest(incoming, (response) => {
      response.emit('data', Buffer.alloc(RECIPE_IMPORT_MAX_BYTES));
      response.emit('data', Buffer.alloc(1));
      response.emit('end');
    });

    await expect(fetchPinnedHttpUrl(recipeUrl, pinned, {})).rejects.toBeInstanceOf(
      InvalidRecipeImportUrlError
    );
    expect(clientRequest.destroy).toHaveBeenCalled();
    expect(incoming.destroy).toHaveBeenCalled();
  });

  it('rejects a redirect hop whose Content-Length is over 1 MiB before reading the body', async () => {
    const incoming = fakeIncoming(
      {
        'content-length': String(RECIPE_IMPORT_MAX_BYTES + 1),
        location: 'https://example.com/next',
      },
      302
    );
    const clientRequest = installRequest(incoming, (response) => {
      response.emit('data', Buffer.alloc(64));
      response.emit('end');
    });

    await expect(fetchPinnedHttpUrl(recipeUrl, pinned, {})).rejects.toBeInstanceOf(
      InvalidRecipeImportUrlError
    );
    expect(clientRequest.destroy).toHaveBeenCalled();
    expect(incoming.destroy).toHaveBeenCalled();
  });
});
