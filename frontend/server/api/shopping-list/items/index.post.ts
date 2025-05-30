import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const familyGroupId = getRouterParam(event, 'family_group_id');
    const { name, shopping_list_categories } = await readBody(event);
    if (!name || !shopping_list_categories) {
      throw createError({
        statusCode: 400,
        message: 'Name and shopping list categories are required'
      });
    }
    const result = await authenticatedFetch(event, `/shopping-list/${familyGroupId}/items`, {
      method: 'POST',
      body: JSON.stringify({ name, shopping_list_categories }),
    });
    return result;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to add item'
    });
  }
});
