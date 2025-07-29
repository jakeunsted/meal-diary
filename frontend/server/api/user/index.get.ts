import { apiFetch } from '../../utils/fetch';

export default defineEventHandler(async (event) => {
  const users = await apiFetch('/users', {}, event);
  return users;
});
