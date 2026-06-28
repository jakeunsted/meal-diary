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

    // Allow partial updates: at least one updatable field must be present
    if (body.name === undefined && body.checked === undefined) {
      throw createError({
        statusCode: 400,
        message: 'At least one of name or checked is required'
      });
    }

    // Validate field types only for the fields that are present
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
      throw createError({
        statusCode: 400,
        message: 'Name must be a non-empty string'
      });
    }

    if (body.checked !== undefined && typeof body.checked !== 'boolean') {
      throw createError({
        statusCode: 400,
        message: 'Checked status must be a boolean'
      });
    }

    const payload: { name?: string; checked?: boolean } = {};
    if (body.name !== undefined) {
      payload.name = body.name;
    }
    if (body.checked !== undefined) {
      payload.checked = body.checked;
    }

    const result = await authenticatedFetch(event, `/shopping-list/${familyGroupId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    return result;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to update item'
    });
  }
});
