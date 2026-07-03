import { apiFetch } from '~/server/utils/fetch';
import { SSE_EMITTER } from '~/server/plugins/sse';
import { tokenMeta, tokenPreview } from '~/utils/tokenDebug';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    family_group_id?: number;
  };
}

export default defineEventHandler(async (event) => {
  const startedAt = Date.now();
  try {
    const body = await readBody(event);
    const { refreshToken, requestId } = body as {
      refreshToken?: string;
      requestId?: string;
    };
    const correlationId = requestId ?? `nuxt-${Date.now().toString(36)}`;

    console.log('[Token Debug][Nuxt] refresh-token: received', {
      requestId: correlationId,
      refreshToken: tokenMeta(refreshToken),
    });
    
    if (!refreshToken) {
      console.error('[Token Debug][Nuxt] refresh-token: missing refresh token', {
        requestId: correlationId,
      });
      throw createError({
        statusCode: 400,
        message: 'Refresh token is required'
      });
    }
    
    const response = await apiFetch<TokenResponse>('/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken, requestId: correlationId }),
    }, event);

    console.log('[Token Debug][Nuxt] refresh-token: API succeeded', {
      requestId: correlationId,
      userId: response.user?.id,
      familyGroupId: response.user?.family_group_id,
      oldRefreshToken: tokenPreview(refreshToken),
      newRefreshToken: tokenMeta(response.refreshToken),
      newAccessToken: tokenMeta(response.accessToken),
      refreshTokenRotated: response.refreshToken !== refreshToken,
      durationMs: Date.now() - startedAt,
    });
    
    // Emit SSE event for token refresh if user has a family group
    if (response.user?.family_group_id) {
      console.log('[Token Debug][Nuxt] refresh-token: emitting SSE token-refresh', {
        requestId: correlationId,
        userId: response.user.id,
        familyGroupId: response.user.family_group_id,
        newRefreshToken: tokenPreview(response.refreshToken),
      });
      SSE_EMITTER.emit(`family-${response.user.family_group_id}`, 'token-refresh', {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        userId: response.user.id
      });
    }
    
    return response;
  } catch (error: any) {
    console.error('[Token Debug][Nuxt] refresh-token: failed', {
      statusCode: error.statusCode,
      message: error.message,
      durationMs: Date.now() - startedAt,
    });

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
