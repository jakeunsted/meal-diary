import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    const response = await authenticatedFetch(event, '/family-groups', {
      method: 'POST',
      body: JSON.stringify(body), 
    });

    return response;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to create family group'
    });
  }
});
