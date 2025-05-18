import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const { family_group_id } = getRouterParams(event);
  const { category_name } = getQuery(event);

  if (!family_group_id || !category_name) {
    throw createError({
      statusCode: 400,
      message: 'Missing required parameters'
    });
  }

  try {
    const response = await apiFetch(`/shopping-list/${family_group_id}/delete-category`, {
      method: 'DELETE',
      query: {
        category_name: category_name as string
      }
    });

    return response;
  } catch (error) {
    console.error('Error deleting category:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to delete category'
    });
  }
});
