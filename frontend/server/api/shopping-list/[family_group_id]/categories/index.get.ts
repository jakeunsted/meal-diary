import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const familyGroupId = getRouterParam(event, 'family_group_id');
    const categories = await authenticatedFetch(event, `/shopping-list/${familyGroupId}/categories`, {
      method: 'GET',
    });
    return categories;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch categories'
    });
  }
});
