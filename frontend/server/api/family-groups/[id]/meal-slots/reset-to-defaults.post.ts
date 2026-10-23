import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'id');

  if (!familyGroupId) {
    throw createError({
      statusCode: 400,
      message: 'Family group ID is required',
    });
  }

  const body = await readBody(event);

  const { data } = await authenticatedFetch(
    event,
    `/family-groups/${familyGroupId}/meal-slots/reset-to-defaults`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

  return data;
});
