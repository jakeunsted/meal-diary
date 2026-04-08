import { apiFetch } from '~~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const response = await apiFetch('/recipes', {
    method: 'POST',
    body: JSON.stringify(body),
  }, event);

  return response;
});
