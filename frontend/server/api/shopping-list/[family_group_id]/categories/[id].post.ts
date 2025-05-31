import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'family_group_id');
  const categoryId = getRouterParam(event, 'id');
  try {
    const result = await authenticatedFetch(event, `/shopping-list/${familyGroupId}/categories/${categoryId}`, {
      method: 'POST',
    });
    return result;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to add category'
    });
  }
});
