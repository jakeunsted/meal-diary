/**
 * Serialises concurrent token refresh attempts across useApi, initializeAuth,
 * and the app-resume handler. Prevents rotation races on mobile where multiple
 * callers can fire at once when the app returns from background.
 */
let refreshPromise: Promise<void> | null = null;

export async function runWithTokenRefreshLock(refreshFn: () => Promise<void>): Promise<void> {
  if (refreshPromise) {
    await refreshPromise;
    return;
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
