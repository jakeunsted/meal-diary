import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  try {
    await apiFetch('/alexa/link', { method: 'DELETE' }, event);
    setResponseStatus(event, 204);
    return null;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to disconnect Alexa',
      data: {
        message: error.message,
        code: error.code,
      },
    });
  }
});
