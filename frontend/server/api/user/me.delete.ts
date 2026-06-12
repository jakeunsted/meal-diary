import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    return await authenticatedFetch(event, '/users/me', {
      method: 'DELETE',
      body: JSON.stringify(body),
    });
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to delete account',
    });
  }
});
