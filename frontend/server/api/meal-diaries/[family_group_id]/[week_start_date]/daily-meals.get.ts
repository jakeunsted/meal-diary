import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const { family_group_id, week_start_date } = getRouterParams(event);

  if (!family_group_id || !week_start_date) {
    throw createError({ statusCode: 400, statusMessage: 'Missing parameters' });
  }

  const response = await apiFetch(`/meal-diaries/${family_group_id}/daily-meals`, {
    method: 'GET',
    query: { week_start_date }
  });

  return response;
});
