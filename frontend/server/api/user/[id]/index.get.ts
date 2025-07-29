import { apiFetch } from '../../../utils/fetch';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const user = await apiFetch(`/users/${id}`, {}, event);
  return user;
});
