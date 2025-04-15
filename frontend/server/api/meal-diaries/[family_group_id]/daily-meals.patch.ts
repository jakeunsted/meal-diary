import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'family_group_id');
  const body = await readBody(event);

  const response = await apiFetch(`/api/meal-diaries/${familyGroupId}/daily-meals`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

  return response;
});
