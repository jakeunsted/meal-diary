import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id');
    return await authenticatedFetch(event, `/family-groups/${id}/leave`, {
      method: 'POST',
    });
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to leave family group',
    });
  }
});
