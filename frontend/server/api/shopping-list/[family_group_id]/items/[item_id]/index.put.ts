import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const familyGroupId = getRouterParam(event, 'family_group_id');
    const itemId = getRouterParam(event, 'item_id');
    const body = await readBody(event);

    if (!familyGroupId || !itemId) {
      throw createError({
        statusCode: 400,
        message: 'Family group ID and item ID are required'
      });
    }

    // Validate required fields
    if (body.name === undefined || body.checked === undefined) {
      throw createError({
        statusCode: 400,
        message: 'Name and checked status are required'
      });
    }

    // Validate field types
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw createError({
        statusCode: 400,
        message: 'Name must be a non-empty string'
      });
    }

    if (typeof body.checked !== 'boolean') {
      throw createError({
        statusCode: 400,
        message: 'Checked status must be a boolean'
      });
    }

    const result = await authenticatedFetch(event, `/shopping-list/${familyGroupId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: body.name,
        checked: body.checked
      }),
    });

    return result;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to update item'
    });
  }
});
