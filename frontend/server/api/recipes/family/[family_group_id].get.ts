import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'family_group_id');
  const query = getQuery(event);

  if (!familyGroupId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing family group ID' });
  }

  const response = await apiFetch(`/recipes/family/${familyGroupId}`, {
    method: 'GET',
    query: query as Record<string, string>,
  }, event);

  return response;
});
