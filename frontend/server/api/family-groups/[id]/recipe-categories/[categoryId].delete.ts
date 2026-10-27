import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'id');
  const categoryId = getRouterParam(event, 'categoryId');

  try {
    await apiFetch(
      `/family-groups/${familyGroupId}/recipe-categories/${categoryId}`,
      {
        method: 'DELETE',
      },
      event
    );
    return { ok: true };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to delete recipe category',
      data: {
        message: error.message,
        code: error.code,
        feature: error.feature,
        plan: error.plan,
        upgradeUrl: error.upgradeUrl,
      },
    });
  }
});
