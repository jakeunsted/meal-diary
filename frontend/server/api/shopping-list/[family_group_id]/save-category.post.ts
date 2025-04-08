import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { family_group_id } = getRouterParams(event);
  const { category_name, category_contents } = body;

  if (!category_name || !category_contents) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Category name and contents are required',
    });
  }

  const category = await apiFetch(`/shopping-list/${family_group_id}/save-category`, {
    method: 'POST',
    body: JSON.stringify({
      category_name: category_name,
      category_contents: category_contents,
    }),
  });
  return category;
});
