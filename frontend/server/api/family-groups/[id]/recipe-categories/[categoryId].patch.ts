import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'id');
  const categoryId = getRouterParam(event, 'categoryId');
  const body = await readBody(event);

  try {
    return await apiFetch(
      `/family-groups/${familyGroupId}/recipe-categories/${categoryId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
      event
    );
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to rename recipe category',
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
