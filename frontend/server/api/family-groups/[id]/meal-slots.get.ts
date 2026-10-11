import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'id');
  return apiFetch(`/family-groups/${familyGroupId}/meal-slots`, {}, event);
});
