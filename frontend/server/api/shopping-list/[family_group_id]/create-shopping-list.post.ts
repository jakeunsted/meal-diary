import { authenticatedFetch } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const familyGroupId = getRouterParam(event, 'family_group_id');
    const shoppingList = await authenticatedFetch(event, `/shopping-list/${familyGroupId}/create-shopping-list`, {
      method: 'POST',
    });
    return shoppingList;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to create shopping list'
    });
  }
});
