import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing recipe ID' });
  }

  try {
    return await apiFetch(`/recipes/${id}/sync`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, event);
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to sync recipe',
      data: {
        message: error.message,
        code: error.code,
        feature: error.feature,
        upgradeUrl: error.upgradeUrl,
        plan: error.plan,
      },
    });
  }
});
