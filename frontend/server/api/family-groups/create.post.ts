import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    const response = await apiFetch('/family-groups', {
      method: 'POST',
      body: JSON.stringify(body),
    }, event);

    return response;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to create family group'
    });
  }
});
