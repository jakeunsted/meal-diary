import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    return await apiFetch('/users/me/email-change', {
      method: 'POST',
      body: JSON.stringify(body),
    }, event);
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to update email',
    });
  }
});
