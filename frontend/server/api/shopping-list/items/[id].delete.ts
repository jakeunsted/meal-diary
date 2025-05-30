import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const familyGroupId = getRouterParam(event, 'family_group_id');
    const itemId = getRouterParam(event, 'id');
    const result = await authenticatedFetch(event, `/shopping-list/${familyGroupId}/items/${itemId}`, {
      method: 'DELETE',
    });
    return result;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to delete item'
    });
  }
});
