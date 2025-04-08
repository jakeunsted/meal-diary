import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const { family_group_id } = getRouterParams(event);
  const shoppingList = await apiFetch(`/shopping-list/${family_group_id}/create-shopping-list`, {
    method: 'POST',
  });
  return shoppingList;
});
