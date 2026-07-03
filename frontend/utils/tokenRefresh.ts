/**
 * Serialises concurrent token refresh attempts across useApi, initializeAuth,
 * and the app-resume handler. Prevents rotation races on mobile where multiple
 * callers can fire at once when the app returns from background.
 *
 * If a refresh is already in flight, callers wait for it. When the in-flight
 * refresh fails, the next caller retries instead of silently skipping refresh.
 */
let refreshPromise: Promise<void> | null = null;
let lockOwnerId = 0;

export async function runWithTokenRefreshLock(refreshFn: () => Promise<void>): Promise<void> {
  const callerId = ++lockOwnerId;

  if (refreshPromise) {
    console.log('[Token Debug] refreshLock: waiting on in-flight refresh', { callerId });
    try {
      await refreshPromise;
      console.log('[Token Debug] refreshLock: in-flight refresh finished, reusing result', { callerId });
      return;
    } catch (err) {
      console.warn('[Token Debug] refreshLock: in-flight refresh failed, retrying', {
        callerId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Prior refresh failed — fall through so this caller can retry.
    }
  }

  console.log('[Token Debug] refreshLock: starting refresh', { callerId });
  refreshPromise = (async () => {
    try {
      await refreshFn();
      console.log('[Token Debug] refreshLock: refresh completed', { callerId });
    } catch (err) {
      console.error('[Token Debug] refreshLock: refresh threw', {
        callerId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  await refreshPromise;
}

export function isTokenRefreshInProgress(): boolean {
  return refreshPromise !== null;
}
