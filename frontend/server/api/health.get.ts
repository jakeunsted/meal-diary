import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  const response = await apiFetch('/health', {
    method: 'GET',
  }, event);
  return response;
});
