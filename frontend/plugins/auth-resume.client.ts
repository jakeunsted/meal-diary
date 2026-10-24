import { useAuthStore } from '~/stores/auth';
import { useAuth, handleAutoLogout } from '~/composables/useAuth';
import { isTokenExpired } from '~/composables/useJWT';
import { isSessionExpiredError } from '~/utils/httpError';
import { runWithTokenRefreshLock } from '~/utils/tokenRefresh';

/**
 * Refreshes expired access tokens when the website returns to the foreground.
 * A background tab does not re-run route middleware, so without this the store
 * can hold a stale access token until the next navigation.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return;

  const handleAppResume = async () => {
    if (document.visibilityState !== 'visible') return;

    const authStore = useAuthStore();
    if (!authStore.accessToken || !authStore.refreshToken) return;
    if (!isTokenExpired(authStore.accessToken, 0)) return;

    try {
      await runWithTokenRefreshLock(async () => {
        const { refreshTokens } = useAuth();
        await refreshTokens();
      });
    } catch (err: unknown) {
      if (isSessionExpiredError(err)) {
        await handleAutoLogout();
      }
    }
  };

  document.addEventListener('visibilitychange', handleAppResume);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      handleAppResume();
    }
  });
});
