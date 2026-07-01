import { authenticatedFetch } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'id');

  if (!familyGroupId) {
    throw createError({
      statusCode: 400,
      message: 'Family group ID is required',
    });
  }

  const { data } = await authenticatedFetch(
    event,
    `/family-groups/${familyGroupId}/entitlements`
  );

  return data;
});
