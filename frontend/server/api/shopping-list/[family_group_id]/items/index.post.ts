import { authenticatedFetch } from '~~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const familyGroupId = getRouterParam(event, 'family_group_id');
    const { name, parent_item_id } = await readBody(event);

    if (!name) {
      throw createError({
        statusCode: 400,
        message: 'Name is required'
      });
    }
    const result = await authenticatedFetch(event, `/shopping-list/${familyGroupId}/items`, {
      method: 'POST',
      body: JSON.stringify({ name, parent_item_id }),
    });
    return result.data;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to add item'
    });
  }
});
