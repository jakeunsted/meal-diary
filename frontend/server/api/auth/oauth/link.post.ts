import { apiFetch } from '~/server/utils/fetch';
import { User } from '~/types/User';

interface LinkResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { linkToken, password } = body ?? {};

    if (!linkToken || !password) {
      throw createError({
        statusCode: 400,
        message: 'Link token and password are required',
      });
    }

    return await apiFetch<LinkResponse>('/auth/oauth/link', {
      method: 'POST',
      body: JSON.stringify({ linkToken, password }),
    }, event);
  } catch (error: any) {
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || 'Could not link this sign-in method.',
        data: {
          code: error.code,
          linkToken: error.linkToken,
          message: error.message,
        },
      });
    }

    throw createError({
      statusCode: 500,
      message: error.message || 'Could not link this sign-in method.',
    });
  }
});
