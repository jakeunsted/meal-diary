import { apiFetch } from '~/server/utils/fetch';
import { SSE_EMITTER } from '~/server/plugins/sse';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    family_group_id?: number;
  };
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
    
    // Emit SSE event for token refresh if user has a family group
    if (response.user?.family_group_id) {
      SSE_EMITTER.emit(`family-${response.user.family_group_id}`, 'token-refresh', {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        userId: response.user.id
      });
    }
    
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