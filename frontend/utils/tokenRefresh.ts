/**
 * Serialises concurrent token refresh attempts across useApi, initializeAuth,
 * and the app-resume handler. Prevents rotation races on mobile where multiple
 * callers can fire at once when the app returns from background.
 *
 * If a refresh is already in flight, callers wait for it. When the in-flight
 * refresh fails, the next caller retries instead of silently skipping refresh.
 */
let refreshPromise: Promise<void> | null = null;

export async function runWithTokenRefreshLock(refreshFn: () => Promise<void>): Promise<void> {
  if (refreshPromise) {
    try {
      await refreshPromise;
      return;
    } catch {
      // Prior refresh failed — fall through so this caller can retry.
    }
  }

  refreshPromise = (async () => {
    try {
      await refreshFn();
    } finally {
      refreshPromise = null;
    }
  })();

  await refreshPromise;
}

export function isTokenRefreshInProgress(): boolean {
  return refreshPromise !== null;
}
