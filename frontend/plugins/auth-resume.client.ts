import { useAuthStore } from '~/stores/auth';
import { useAuth, handleAutoLogout } from '~/composables/useAuth';
import { isTokenExpired } from '~/composables/useJWT';
import { isSessionExpiredError } from '~/utils/httpError';
import { runWithTokenRefreshLock } from '~/utils/tokenRefresh';

/**
 * Refreshes expired access tokens when the Capacitor app returns to the
 * foreground. Mobile WebViews don't re-run route middleware on resume, so
 * without this the store can hold a stale access token until the next
 * navigation — and a failed proactive refresh would previously log the user out.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return;

  const handleAppResume = async () => {
    if (document.visibilityState !== 'visible') return;

    const authStore = useAuthStore();
    if (!authStore.accessToken || !authStore.refreshToken) return;
    if (!isTokenExpired(authStore.accessToken, 0)) return;

    console.log('[Token Debug] app resume: access token expired, refreshing');
    try {
      await runWithTokenRefreshLock(async () => {
        const { refreshTokens } = useAuth();
        await refreshTokens();
      });
      console.log('[Token Debug] app resume: token refresh succeeded');
    } catch (err: unknown) {
      console.error('[Token Debug] app resume: token refresh failed', {
        isSessionExpired: isSessionExpiredError(err),
      });
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
