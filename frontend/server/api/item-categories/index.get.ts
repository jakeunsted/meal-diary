import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    console.log('fetching item categories');
    const categories = await authenticatedFetch(event, '/item-categories', {
      method: 'GET',
    });
    console.log('item categories', categories);
    return categories;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch item categories'
    });
  }
});
