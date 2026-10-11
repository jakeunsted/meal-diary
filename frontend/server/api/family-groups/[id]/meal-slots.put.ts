import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'id');
  const body = await readBody(event);

  return apiFetch(
    `/family-groups/${familyGroupId}/meal-slots`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
    event
  );
});
