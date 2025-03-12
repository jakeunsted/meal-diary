import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const users = await apiFetch('/users');
  return users;
});
