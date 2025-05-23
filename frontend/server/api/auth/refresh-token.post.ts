import { apiFetch } from '~/server/utils/fetch';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { refreshToken } = body;
    
    if (!refreshToken) {
      throw createError({
        statusCode: 400,
        message: 'Refresh token is required'
      });
    }
    
    const response = await apiFetch<TokenResponse>('/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }, event);
    
    return response;
  } catch (error: any) {
    // If the error is from the API, pass through the status code and message
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || 'Token refresh failed'
      });
    }
    
    // For other errors, return a generic error
    throw createError({
      statusCode: 500,
      message: error.message || 'An error occurred during token refresh'
    });
  }
}); 