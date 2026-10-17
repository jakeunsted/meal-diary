import { apiFetch } from '~/server/utils/fetch';
import { User } from '~/types/User';

interface GoogleExchangeResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { code } = body;

    if (!code || typeof code !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Exchange code is required',
      });
    }

    const response = await apiFetch<GoogleExchangeResponse>('/auth/google/exchange', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }, event);

    return response;
  } catch (error: any) {
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || 'OAuth exchange failed',
      });
    }

    throw createError({
      statusCode: 500,
      message: error.message || 'An error occurred during OAuth exchange',
    });
  }
});
