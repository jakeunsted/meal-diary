import { H3Event } from 'h3';
import type { TokenResponse } from '~/types/Auth';
import type { ApiResponse } from '~/types/Api';

export async function authenticatedFetch<T>(
  event: H3Event,
  url: string,
  options: { headers?: Record<string, string> } = {}
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
        headers: {
          'Authorization': `Bearer ${token}`,
          ...options.headers
        }
      });
      console.log('response', response);
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
        }
      } catch (refreshError) {
        throw createError({
          statusCode: 401,
          message: 'Failed to refresh token'
        });
      }
    }
    
    throw error;
  }
} 