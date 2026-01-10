import { H3Event } from 'h3';
import type { TokenResponse } from '~/types/Auth';
import type { ApiResponse } from '~/types/Api';
import { isTokenExpired } from './jwt';

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

/**
 * Refresh the access token using the refresh token
 * @param refreshToken - The refresh token
 * @param baseUrl - The base URL for the API
 * @returns The new access token and refresh token
 */
async function refreshAccessToken(refreshToken: string, baseUrl: string): Promise<TokenResponse> {
  const refreshResponse = await fetch(`${baseUrl}/auth/refresh-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!refreshResponse.ok) {
    const errorData = await refreshResponse.json().catch(() => ({ message: 'Failed to refresh token' }));
    console.error('[authenticatedFetch] Token refresh failed:', {
      status: refreshResponse.status,
      error: errorData.message || 'Failed to refresh token'
    });
    throw {
      statusCode: refreshResponse.status,
      message: errorData.message || 'Failed to refresh token'
    };
  }

  return await refreshResponse.json() as TokenResponse;
}

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

  // Extract token from "Bearer <token>" format
  let accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  // Check if token is expired before making the request
  // Only check if we have a refresh token available
  if (refreshToken) {
    const expired = isTokenExpired(accessToken);

    if (expired) {
      try {
        const config = useRuntimeConfig();
        const baseUrl = config.public.baseUrl;
        const tokenData = await refreshAccessToken(refreshToken, baseUrl);
        accessToken = tokenData.accessToken;
      } catch (error: any) {
        console.error('[authenticatedFetch] Failed to refresh token:', {
          error: error.message,
          statusCode: error.statusCode
        });
        // If refresh fails, trigger automatic logout
        if (process.client) {
          const { handleAutoLogout } = await import('~/composables/useAuth');
          await handleAutoLogout();
        }
        throw createError({
          statusCode: error.statusCode || 401,
          message: error.message || 'Failed to refresh token'
        });
      }
    }
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
    // Try with current token (which may have been refreshed above)
    return await makeRequest(accessToken);
  } catch (error: any) {
    // If we get a 401 and have a refresh token, try to refresh
    // This is a fallback in case the token expired between our check and the actual request
    if (error.statusCode === 401 && refreshToken) {
      try {
        const config = useRuntimeConfig();
        const baseUrl = config.public.baseUrl;
        const data = await refreshAccessToken(refreshToken, baseUrl);
        
        // Retry the original request with new token
        const result = await makeRequest(data.accessToken);
        
        return {
          ...result,
          headers: {
            'x-new-access-token': data.accessToken,
            'x-new-refresh-token': data.refreshToken
          }
        };
      } catch (refreshError: any) {
        // If refresh fails, trigger automatic logout
        console.error('[authenticatedFetch] Token refresh failed (fallback):', {
          error: refreshError.message,
          statusCode: refreshError.statusCode
        });
        if (process.client) {
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