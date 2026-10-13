import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { token, password } = body;

    if (!token || !password) {
      throw createError({
        statusCode: 400,
        message: 'Token and password are required'
      });
    }

    return await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }, event);
  } catch (error: any) {
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || 'Unable to reset password'
      });
    }

    throw createError({
      statusCode: 500,
      message: error.message || 'Unable to reset password'
    });
  }
});
