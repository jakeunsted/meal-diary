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
