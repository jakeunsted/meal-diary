import { H3Event } from 'h3';
import type { TokenResponse } from '~/types/Auth';
import type { ApiResponse } from '~/types/Api';

/**
 * Handles automatic logout when token refresh fails
 * This function clears auth state and redirects to login
 */
export const handleAutoLogout = () => {
  // Clear auth state from storage
  if (process.client) {
    try {
      localStorage.removeItem('auth');
      // Also clear any other auth-related storage
      localStorage.removeItem('mealDiary');
      localStorage.removeItem('shoppingList');
    } catch (error) {
      console.error('[Auto Logout] Failed to clear localStorage:', error);
    }
  }
};

export async function authenticatedFetch<T>(
  event: H3Event,
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const authHeader = getHeader(event, 'authorization');
  const refreshToken = getHeader(event, 'x-refresh-token');

  if (!authHeader) {
    throw createError({
      statusCode: 401,
      message: 'No token provided to server'
    });
  }

  const makeRequest = async (token: string) => {
    try {
      const response = await apiFetch<T>(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          ...options.headers
        }
      }, event);
      return {
        data: response,
        headers: {}
      };
    } catch (error: any) {
      if (error.statusCode === 401) {
        throw error;
      }
      throw createError({
        statusCode: error.statusCode || 500,
        message: error.message || 'Request failed'
      });
    }
  };

  try {
    // Try with current token first
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    return await makeRequest(token);
  } catch (error: any) {
    // If we get a 401 and have a refresh token, try to refresh
    if (error.statusCode === 401 && refreshToken) {
      try {
        const config = useRuntimeConfig();
        const baseUrl = config.public.baseUrl;
        
        // Attempt to refresh the token
        const refreshResponse = await fetch(`${baseUrl}/auth/refresh-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json() as TokenResponse;
          
          // Retry the original request with new token
          const result = await makeRequest(data.accessToken);
          
          return {
            ...result,
            headers: {
              'x-new-access-token': data.accessToken,
              'x-new-refresh-token': data.refreshToken
            }
          };
        } else {
          // If refresh fails, preserve the original status code and message from the API
          const errorData = await refreshResponse.json().catch(() => ({ message: 'Failed to refresh token' }));
          const originalStatusCode = refreshResponse.status;
          const originalMessage = errorData.message || 'Failed to refresh token';
          
          // If refresh fails, trigger automatic logout
          console.log('[Authenticated Fetch] Token refresh failed, triggering automatic logout');
          if (process.client) {
            // Import and call the auto logout function
            const { handleAutoLogout } = await import('~/composables/useAuth');
            await handleAutoLogout();
          }
          
          // Preserve the original status code (e.g., 403 for invalid/expired token)
          throw createError({
            statusCode: originalStatusCode,
            message: originalMessage
          });
        }
      } catch (refreshError: any) {
        // If refresh fails, trigger automatic logout
        console.log('[Authenticated Fetch] Token refresh failed, triggering automatic logout');
        if (process.client) {
          // Import and call the auto logout function
          const { handleAutoLogout } = await import('~/composables/useAuth');
          await handleAutoLogout();
        }
        
        // Preserve the original error status code if available, otherwise use 401
        const statusCode = refreshError?.statusCode || refreshError?.response?.status || 401;
        const message = refreshError?.message || refreshError?.data?.message || 'Failed to refresh token';
        
        throw createError({
          statusCode,
          message
        });
      }
    }
    
    throw error;
  }
} 