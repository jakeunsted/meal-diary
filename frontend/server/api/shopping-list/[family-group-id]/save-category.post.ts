import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { family_group_id } = getRouterParams(event);
  const { name, contents } = body;

  if (!name || !contents) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Name and contents are required',
    });
  }

  // Need to get family group id from user store
  // const familyGroupId = user.familyGroupId;
  // const familyGroupId = 18;

  const category = await apiFetch(`/shopping-list/${family_group_id}/categories`, {
    method: 'POST',
    body: JSON.stringify({
      category_name: name,
      category_contents: contents,
    }),
  });
  return category;
});
