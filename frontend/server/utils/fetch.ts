import { H3Event } from 'h3';
import { useAuthStore } from '~/stores/auth';
import { SSE_EMITTER } from '~/server/plugins/sse';

/**
 * Custom fetch export to use baseUrl from .env and return json
 * @param path - The path to fetch
 * @param options - The options to fetch
 * @returns The response from the fetch
 */
interface ApiFetchOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiFetch<T = any>(path: string, options: ApiFetchOptions = {}, event?: H3Event): Promise<T> {
  const config = useRuntimeConfig();
  const baseUrl = config.public.baseUrl;
  console.log('baseUrl', baseUrl);
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
  if (event) {
    const authHeader = getHeader(event, 'authorization');
    const refreshToken = getHeader(event, 'x-refresh-token');

    if (authHeader) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Authorization': authHeader,
      };
    }

    if (refreshToken) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'x-refresh-token': refreshToken,
      };
    }
  }

  console.log('Calling API: ', finalUrl);

  const response = await fetch(finalUrl, fetchOptions);
  
  // If we get a 401 and have a refresh token, try to refresh
  if (response.status === 401 && event) {
    const refreshToken = getHeader(event, 'x-refresh-token');
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${baseUrl}/auth/refresh-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });
        
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          
          // Update the auth store with new token
          const authStore = useAuthStore();
          authStore.setAccessToken(data.accessToken);
          authStore.setRefreshToken(data.refreshToken);

          // Emit SSE event for token refresh if user has a family group
          if (data.user?.family_group_id) {
            SSE_EMITTER.emit(`family-${data.user.family_group_id}`, 'token-refresh', {
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              userId: data.user.id
            });
          }

          // Retry the original request with new token
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Authorization': `Bearer ${data.accessToken}`,
          };
          const retryResponse = await fetch(finalUrl, fetchOptions);
          
          if (!retryResponse.ok) {
            console.error('[Token Refresh] Retry request failed:', retryResponse.status);
            const error = await retryResponse.json().catch(() => ({ message: 'Unknown error' }));
            throw { 
              statusCode: retryResponse.status, 
              message: error.message || `API error: ${retryResponse.statusText}`
            };
          }
          
          return retryResponse.json();
        }
        console.error('[Token Refresh] Refresh request failed:', refreshResponse.status);
        const error = await refreshResponse.json().catch(() => ({ message: 'Unknown error' }));
        
        // If refresh fails, trigger automatic logout
        if (process.client) {
          // Import and call the auto logout function
          const { handleAutoLogout } = await import('~/composables/useAuth');
          await handleAutoLogout();
        }
        
        throw error;
      } catch (error) {
        console.error('[Token Refresh] Error during token refresh:', error);
        
        // If refresh fails, trigger automatic logout
        if (process.client) {
          // Import and call the auto logout function
          const { handleAutoLogout } = await import('~/composables/useAuth');
          await handleAutoLogout();
        }
        
        throw error;
      }
    }
  }
  
  // If response is not ok and we didn't handle it above, throw error
  if (!response.ok) {
    console.error('[API Request] Request failed:', response.status);
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw { 
      statusCode: response.status, 
      message: error.message || `API error: ${response.statusText}`
    };
  }
  
  return response.json();
}
