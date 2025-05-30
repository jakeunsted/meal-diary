import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const familyGroupId = getRouterParam(event, 'family_group_id');
    const itemId = getRouterParam(event, 'id');
    const { name, checked, shopping_list_categories } = await readBody(event);
    if (!name || !shopping_list_categories || !checked) {
      throw createError({
        statusCode: 400,
        message: 'Name, checked and shopping list categories are required'
      });
    }
    const result = await authenticatedFetch(event, `/shopping-list/${familyGroupId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, checked, shopping_list_categories }),
    });
    return result;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to update item'
    });
  }
});
