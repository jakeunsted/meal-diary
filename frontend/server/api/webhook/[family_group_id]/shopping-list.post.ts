import { useShoppingListStore } from '~/stores/shoppingList';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'family_group_id');
  if (!familyGroupId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Family group ID is required',
    });
  }
  
  const body = await readBody(event);
  console.log('family updated shopping-list: ', body);

  const shoppingListStore = useShoppingListStore();
  shoppingListStore.fetchShoppingList(Number(familyGroupId));
});
