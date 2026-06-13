import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id');
    const body = await readBody(event);
    return await authenticatedFetch(event, `/family-groups/${id}/transfer-ownership`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to transfer ownership',
    });
  }
});
