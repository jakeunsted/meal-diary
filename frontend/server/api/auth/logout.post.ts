import { apiFetch } from '~/server/utils/fetch';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event).catch(() => ({} as Record<string, unknown>));
    // Prefer x-refresh-token: useApi stamps it after ensureFreshTokens, so it
    // matches the active session even when the request body was built earlier.
    const headerRefresh = getHeader(event, 'x-refresh-token');
    const bodyRefresh =
      typeof body?.refreshToken === 'string' ? body.refreshToken : undefined;
    const refreshToken = headerRefresh || bodyRefresh;

    await apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    }, event);
    
    return { success: true };
  } catch (error: any) {
    // Even if the API call fails, we want to log the user out on the frontend
    // So we'll just log the error and return success
    console.error('Logout error:', error);
    return { success: true };
  }
});
