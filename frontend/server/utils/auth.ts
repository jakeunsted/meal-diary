import { H3Event } from 'h3';
import type { ApiResponse } from '~/types/Api';
import { apiFetch } from '~/server/utils/fetch';
import { tokenMeta } from '~/utils/tokenDebug';

/**
 * Proxy an authenticated request to the API, forwarding bearer and refresh
 * headers from the client. Token refresh is handled exclusively on the client
 * (useApi / initializeAuth) to avoid rotation races where the server refreshes
 * with a stale refresh token and the client never receives the new pair.
 */
export async function authenticatedFetch<T>(
  event: H3Event,
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const authHeader = getHeader(event, 'authorization');
  const refreshToken = getHeader(event, 'x-refresh-token');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!authHeader) {
    console.warn('[Token Debug][Nuxt] authenticatedFetch: no Authorization header', { url });
    throw createError({
      statusCode: 401,
      message: 'No token provided to server',
    });
  }

  console.log('[Token Debug][Nuxt] authenticatedFetch: proxying (no server-side refresh)', {
    url,
    accessToken: tokenMeta(accessToken),
    hasRefreshTokenHeader: !!refreshToken,
    refreshToken: tokenMeta(refreshToken),
  });

  try {
    const data = await apiFetch<T>(url, options, event);
    return { data, headers: {} };
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    console.warn('[Token Debug][Nuxt] authenticatedFetch: upstream failed', {
      url,
      statusCode: e.statusCode,
      message: e.message,
      accessToken: tokenMeta(accessToken),
      refreshToken: tokenMeta(refreshToken),
    });
    throw err;
  }
}
