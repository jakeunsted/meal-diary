import { apiFetch } from '~/server/utils/fetch';
import { User } from '~/types/User';

interface AppleAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { idToken, nonce, givenName, familyName, currentPassword } = body ?? {};

    if (!idToken || !nonce) {
      throw createError({
        statusCode: 400,
        message: 'ID token and nonce are required'
      });
    }

    const response = await apiFetch<AppleAuthResponse>('/auth/apple/verify-token', {
      method: 'POST',
      body: JSON.stringify({
        idToken,
        nonce,
        ...(givenName ? { givenName } : {}),
        ...(familyName ? { familyName } : {}),
        ...(currentPassword ? { currentPassword } : {}),
      }),
    }, event);

    return response;
  } catch (error: any) {
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || 'Token verification failed',
        data: {
          code: error.code,
          linkToken: error.linkToken,
          message: error.message,
        },
      });
    }

    throw createError({
      statusCode: 500,
      message: error.message || 'An error occurred during Apple token verification'
    });
  }
});
