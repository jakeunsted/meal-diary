import { handleAutoLogout } from '~/composables/useAuth';
import { isSessionExpiredError } from '~/utils/httpError';

export default defineNuxtPlugin(() => {
  // Note: We don't override global fetch here because:
  // 1. Requests through $fetch (used by useApi) go through Nuxt server which handles token refresh
  // 2. The useApi composable handles auth errors and triggers logout if needed
  // 3. We only handle unhandled promise rejections below as a last-resort safety net

  if (process.client) {
    window.addEventListener('unhandledrejection', async (event) => {
      console.error('[Global Error Handler] Unhandled promise rejection:', event.reason);

      // Only trigger logout for definitive session-expired errors, not generic
      // permission/RBAC 403s which should not force the user to re-authenticate.
      if (isSessionExpiredError(event.reason)) {
        console.log('[Global Error Handler] Session expired in unhandled rejection, triggering automatic logout');
        event.preventDefault();
        await handleAutoLogout();
      }
    });
  }
});
