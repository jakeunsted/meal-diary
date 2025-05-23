import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);
  const user = await apiFetch(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }, event);
  return user;
});
