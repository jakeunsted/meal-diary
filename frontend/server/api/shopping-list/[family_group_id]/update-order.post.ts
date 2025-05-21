import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { family_group_id } = getRouterParams(event);
  const { categories } = body;

  if (!categories || !Array.isArray(categories)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Categories array is required',
    });
  }

  const updatedList = await apiFetch(`/shopping-list/${family_group_id}/update-order`, {
    method: 'POST',
    body: JSON.stringify({
      categories: categories,
    }),
  });
  return updatedList;
});
