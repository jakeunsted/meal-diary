import { authenticatedFetch } from '~~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const familyGroupId = getRouterParam(event, 'family_group_id');
    const body = await readBody(event);

    if (!familyGroupId) {
      throw createError({
        statusCode: 400,
        message: 'Family group ID is required'
      });
    }

    if (!body?.items || !Array.isArray(body.items) || !body.items.length) {
      throw createError({
        statusCode: 400,
        message: 'Items array is required'
      });
    }

    const result = await authenticatedFetch(event, `/shopping-list/${familyGroupId}/items/bulk`, {
      method: 'POST',
      body: JSON.stringify({
        items: body.items
      }),
    });

    return result.data;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to add items in bulk'
    });
  }
});

