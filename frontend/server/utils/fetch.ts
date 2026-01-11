import { H3Event } from 'h3';
import { SSE_EMITTER } from '~/server/plugins/sse';
import { isTokenExpired, decodeJWT } from './jwt';

/**
 * Custom fetch export to use baseUrl from .env and return json
 * @param path - The path to fetch
 * @param options - The options to fetch
 * @returns The response from the fetch
 */
interface ApiFetchOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
}

/**
 * Refresh the access token using the refresh token
 * @param refreshToken - The refresh token
 * @param baseUrl - The base URL for the API
 * @returns The new access token and refresh token
 */
async function refreshAccessToken(refreshToken: string, baseUrl: string): Promise<{ accessToken: string; refreshToken: string; user?: { id: number; family_group_id?: number } }> {
  const refreshResponse = await fetch(`${baseUrl}/auth/refresh-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!refreshResponse.ok) {
    const errorData = await refreshResponse.json().catch(() => ({ message: 'Unknown error' }));
    throw {
      statusCode: refreshResponse.status,
      message: errorData.message || 'Token refresh failed',
      error: true,
      url: `${baseUrl}/auth/refresh-token`,
      statusMessage: refreshResponse.statusText
    };
  }

  const tokenData = await refreshResponse.json();
  return tokenData;
}

export async function apiFetch<T = any>(path: string, options: ApiFetchOptions = {}, event?: H3Event): Promise<T> {
  const config = useRuntimeConfig();
  const baseUrl = config.public.baseUrl;
  let finalUrl = `${baseUrl}${path}`;

  if (options.query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + params.toString();
  }

  const { query, ...fetchOptions } = options;

  if (fetchOptions.method === 'POST' || fetchOptions.method === 'PUT' || fetchOptions.method === 'PATCH') {
    fetchOptions.headers = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };
  }

  // Get auth token from request headers if available
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  if (event) {
    const authHeader = getHeader(event, 'authorization');
    refreshToken = getHeader(event, 'x-refresh-token') || null;

    if (authHeader) {
      // Extract token from "Bearer <token>" format
      accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      
      // Check if token is expired before making the request
      // Only check if we have a refresh token available
      // Use a smaller buffer (30 seconds) on server-side to reduce unnecessary refresh attempts
      if (refreshToken) {
        const expired = isTokenExpired(accessToken, 30);

        if (expired) {
          try {
            const tokenData = await refreshAccessToken(refreshToken, baseUrl);
            accessToken = tokenData.accessToken;
            
            // Update refresh token if a new one was provided
            if (tokenData.refreshToken) {
              refreshToken = tokenData.refreshToken;
            }

            // Emit SSE event for token refresh if user has a family group
            if (tokenData.user?.family_group_id) {
              SSE_EMITTER.emit(`family-${tokenData.user.family_group_id}`, 'token-refresh', {
                accessToken: tokenData.accessToken,
                refreshToken: tokenData.refreshToken,
                userId: tokenData.user.id
              });
            }
          } catch (error: any) {
            // If refresh fails with 403, it might be because the token was just rotated by client
            // Check if the access token in the request is actually still valid (not expired)
            const decoded = decodeJWT(accessToken);
            const issuedAt = decoded?.iat ? decoded.iat * 1000 : null;
            const tokenAge = issuedAt ? Date.now() - issuedAt : null;
            
            // Check if token is actually expired (without buffer) - if not, it's still valid
            const actuallyExpired = isTokenExpired(accessToken, 0); // No buffer for actual expiration check
            
            // If the access token is still valid (not actually expired) and refresh failed with 403, 
            // the client likely just refreshed and the old refresh token was deleted
            // Proceed with the access token from the request (it's the new one from client refresh)
            if (!actuallyExpired && error.statusCode === 403) {
              // Don't throw error, proceed with the access token from the request
            } else {
              // On server-side, don't trigger logout - let the error propagate to client
              // The client will handle the error appropriately
              // Only trigger logout if we're actually on the client
              if (process.client) {
                const { handleAutoLogout } = await import('~/composables/useAuth');
                await handleAutoLogout();
              }
              throw error;
            }
          }
        }
      }

      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Authorization': `Bearer ${accessToken}`,
      };
    }

    if (refreshToken) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'x-refresh-token': refreshToken,
      };
    }
  }

  const response = await fetch(finalUrl, fetchOptions);
  
  // If we get a 401 and have a refresh token, try to refresh
  // This is a fallback in case the token expired between our check and the actual request
  if (response.status === 401 && event && refreshToken) {
    try {
      const tokenData = await refreshAccessToken(refreshToken, baseUrl);

      // Emit SSE event for token refresh if user has a family group
      if (tokenData.user?.family_group_id) {
        SSE_EMITTER.emit(`family-${tokenData.user.family_group_id}`, 'token-refresh', {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          userId: tokenData.user.id
        });
      }

      // Retry the original request with new token
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Authorization': `Bearer ${tokenData.accessToken}`,
      };
      const retryResponse = await fetch(finalUrl, fetchOptions);
      
      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({ message: 'Unknown error' }));
        throw { 
          statusCode: retryResponse.status, 
          message: error.message || `API error: ${retryResponse.statusText}`
        };
      }
      
      return retryResponse.json();
    } catch (error: any) {
      console.error('[apiFetch] Token refresh failed (fallback):', {
        error: error.message,
        statusCode: error.statusCode
      });
      
      // Ensure error has proper structure if it doesn't already
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      if (!error.message) {
        error.message = 'Token refresh failed';
      }
      if (!error.error) {
        error.error = true;
      }
      
      // If refresh fails, trigger automatic logout
      if (process.client) {
        const { handleAutoLogout } = await import('~/composables/useAuth');
        await handleAutoLogout();
      }
      
      throw error;
    }
  }
  
  // If response is not ok and we didn't handle it above, throw error
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw { 
      statusCode: response.status, 
      message: error.message || `API error: ${response.statusText}`
    };
  }
  
  return response.json();
}
