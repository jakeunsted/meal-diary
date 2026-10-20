import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  try {
    return await apiFetch('/alexa/oauth/authorize', {
      method: 'POST',
      body: JSON.stringify(body),
    }, event);
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to authorize Alexa',
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
