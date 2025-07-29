import { authenticatedFetch } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const { family_group_id } = getRouterParams(event);
  const shoppingList = await authenticatedFetch(event, `/shopping-list/${family_group_id}`, {
    method: 'GET',
  });
  return shoppingList;
});
