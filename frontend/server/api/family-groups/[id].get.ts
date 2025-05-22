import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Family group ID is required'
    });
  }

  return await authenticatedFetch(event, `/family-groups/${id}`);
}); 