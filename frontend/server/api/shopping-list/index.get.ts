import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const shoppingList = await apiFetch('/shopping-list');
  return shoppingList;
});
