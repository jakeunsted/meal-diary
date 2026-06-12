import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id');
    const user = await apiFetch(`/users/${id}`, {}, event);
    return user;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch user',
    });
  }
});
