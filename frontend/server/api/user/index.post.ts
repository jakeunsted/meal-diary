import { apiFetch } from '../../utils/fetch';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const user = await apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(body),
  }, event);
  return user;
});
