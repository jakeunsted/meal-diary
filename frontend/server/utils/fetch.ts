import { H3Event } from 'h3';

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
          console.log('[Token Refresh] Token refresh successful');

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
        }
        console.error('[Token Refresh] Refresh request failed:', refreshResponse.status);
        const error = await refreshResponse.json().catch(() => ({ message: 'Unknown error' }));
        throw error;
      } catch (error) {
        console.error('[Token Refresh] Error during token refresh:', error);
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
