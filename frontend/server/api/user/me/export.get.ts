import { authenticatedFetch } from '~/server/utils/auth';

// Proxies the export bundle through with auth/token-refresh handling. The
// client fetches this via the api composable (which carries the bearer token)
// and triggers a Blob download, so no download headers are needed here.
export default defineEventHandler(async (event) => {
  try {
    return await authenticatedFetch(event, '/users/me/export');
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to export data',
    });
  }
});
