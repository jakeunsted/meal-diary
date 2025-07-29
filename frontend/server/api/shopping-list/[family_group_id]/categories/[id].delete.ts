import { authenticatedFetch } from '../../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const familyGroupId = getRouterParam(event, 'family_group_id');
    const categoryId = getRouterParam(event, 'id');
    const result = await authenticatedFetch(event, `/shopping-list/${familyGroupId}/categories/${categoryId}`, {
      method: 'DELETE',
    });
    return result;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to delete category'
    });
  }
});
