import { useAuthStore } from "~/stores/auth";

/**
 * Custom fetch export to use baseUrl from .env and return json
 * @param path - The path to fetch
 * @param options - The options to fetch
 * @returns The response from the fetch
 */
interface ApiFetchOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiFetch<T = any>(path: string, options: ApiFetchOptions = {}): Promise<T> {
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

  const authStore = useAuthStore();
  const accessToken = authStore.accessToken;
  const refreshToken = authStore.refreshToken;

  // Add authorization header if token exists
  if (accessToken) {
    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  console.log('Calling API: ', finalUrl);

  const response = await fetch(finalUrl, fetchOptions);
  
  // If we get a 401 and have a refresh token, try to refresh
  if (response.status === 401 && refreshToken) {
    console.log('[Token Refresh] Attempting to refresh token after 401 response');
    try {
      console.log('[Token Refresh] Making refresh token request to:', `${baseUrl}/auth/refresh-token`);
      const refreshResponse = await fetch(`${baseUrl}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      console.log('[Token Refresh] Refresh response status:', refreshResponse.status);
      
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        console.log('[Token Refresh] Token refresh successful, updating auth store');
        // Update auth store with new tokens
        authStore.setAuth({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });

        // Retry the original request with new token
        console.log('[Token Refresh] Retrying original request with new token');
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
        
        console.log('[Token Refresh] Retry request successful');
        return retryResponse.json();
      } else {
        console.error('[Token Refresh] Refresh request failed:', refreshResponse.status);
        const error = await refreshResponse.json().catch(() => ({ message: 'Unknown error' }));
        throw error;
      }
    } catch (error) {
      console.error('[Token Refresh] Error during token refresh:', error);
      // If refresh fails, clear auth and throw error
      authStore.clearAuth();
      throw error;
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
