import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  try {
    return await apiFetch('/alexa/link', { method: 'GET' }, event);
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to load Alexa link',
      data: {
        message: error.message,
        code: error.code,
      },
    });
  }
});
