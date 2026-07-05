import { H3Event } from 'h3';
import type { ApiResponse } from '~/types/Api';
import { apiFetch } from '~/server/utils/fetch';

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

  if (!authHeader) {
    throw createError({
      statusCode: 401,
      message: 'No token provided to server',
    });
  }

  const data = await apiFetch<T>(url, options, event);

  return { data, headers: {} };
}
