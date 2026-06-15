import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const user = await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }, event);
    return user;
  } catch (error: any) {
    // apiFetch throws plain { statusCode, message } objects — wrap them so
    // h3 propagates the real status instead of a generic 500
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to create user',
      data: {
        code: error.code,
        feature: error.feature,
        upgradeUrl: error.upgradeUrl,
      },
    });
  }
});
