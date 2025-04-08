import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const { family_group_id } = getRouterParams(event);
  console.log('family_group_id in business logic', family_group_id);
  const shoppingList = await apiFetch(`/shopping-list/${family_group_id}`);
  return shoppingList;
});
