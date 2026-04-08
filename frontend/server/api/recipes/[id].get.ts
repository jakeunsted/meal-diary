import { apiFetch } from '~~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing recipe ID' });
  }

  const response = await apiFetch(`/recipes/${id}`, {
    method: 'GET',
  }, event);

  return response;
});
