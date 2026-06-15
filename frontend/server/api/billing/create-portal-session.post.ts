import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { data } = await authenticatedFetch(event, '/billing/create-portal-session', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return data;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to create billing portal session',
    });
  }
});
