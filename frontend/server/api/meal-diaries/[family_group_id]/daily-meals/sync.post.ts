import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'family_group_id');
  const body = await readBody(event);

  try {
    return await apiFetch(`/meal-diaries/${familyGroupId}/daily-meals/sync`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, event);
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to sync daily meals',
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
