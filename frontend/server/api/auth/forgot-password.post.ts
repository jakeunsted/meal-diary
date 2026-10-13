import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { email } = body;

    if (!email) {
      throw createError({
        statusCode: 400,
        message: 'Email is required'
      });
    }

    return await apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }, event);
  } catch (error: any) {
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || 'Unable to send reset email'
      });
    }

    throw createError({
      statusCode: 500,
      message: error.message || 'Unable to send reset email'
    });
  }
});
