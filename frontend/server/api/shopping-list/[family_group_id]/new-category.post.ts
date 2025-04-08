import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { family_group_id } = getRouterParams(event);

  const { category_name } = body;
  
  if (!category_name) {
    throw createError({
      statusCode: 412,
      statusMessage: 'Category name is required',
    });
  }

  const category = await apiFetch(`/shopping-list/${family_group_id}/new-category`, {
    method: 'POST',
    body: JSON.stringify({
      category_name: category_name,
    }),
  });
  return category;
});
