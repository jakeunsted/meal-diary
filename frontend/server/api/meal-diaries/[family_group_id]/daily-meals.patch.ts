import { apiFetch } from '../../../utils/fetch';

export default defineEventHandler(async (event) => {
  /**
   * Example body:
   * {
      "week_start_date": "2025-04-15",
      "day_of_week": 7,
      "breakfast": "",
      "lunch": "",
      "dinner": ""
    * }
   */

  const familyGroupId = getRouterParam(event, 'family_group_id');
  const body = await readBody(event);

  const response = await apiFetch(`/meal-diaries/${familyGroupId}/daily-meals`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }, event);

  return response;
});
