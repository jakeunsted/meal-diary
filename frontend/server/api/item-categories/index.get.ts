import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const categories = await authenticatedFetch(event, '/item-categories', {
      method: 'GET',
    });
    return categories;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch item categories'
    });
  }
});
