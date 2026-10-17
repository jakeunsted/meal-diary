<template>
  <div class="absolute inset-0 flex items-center justify-center bg-base-100">
    <div class="card w-96 bg-base-200 shadow-xl">
      <div class="card-body">
        <div class="card-title justify-center">
          <h1>{{ $t('Completing sign in...') }}</h1>
        </div>
        <div class="flex justify-center">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
        <div v-if="error" class="alert alert-error mt-4">
          <span>{{ error }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '../../../stores/auth';

/**
 * Google OAuth Callback Page
 *
 * NOTE: This page is only used for web OAuth flow (browser-based authentication).
 * Native apps use Google ID token verification and do not redirect here.
 *
 * Flow:
 * 1. User signs in with Google → API callback stores a one-time exchange code
 * 2. API redirects here with ?exchangeCode=...
 * 3. This page POSTs the code to exchange for session tokens (never in the URL)
 */

definePageMeta({
  layout: false,
  middleware: []
});

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const { reportAuthError } = useAuthAnalytics();

const error = ref('');

onMounted(async () => {
  try {
    const googleCode = String(route.query.code || '');
    const state = String(route.query.state || '');
    const exchangeCode = String(route.query.exchangeCode || '');

    // Direct callback from Google — forward to API (which redirects back with exchangeCode)
    if (googleCode && state) {
      const config = useRuntimeConfig();
      const baseUrl = config.public.baseUrl;

      window.location.href = `${baseUrl}/auth/google/callback?code=${encodeURIComponent(googleCode)}&state=${encodeURIComponent(state)}`;
      return;
    }

    if (!exchangeCode) {
      const errorParam = String(route.query.error || '');
      if (errorParam) {
        error.value = getErrorMessage(errorParam);
        reportAuthError('oauth_callback_client_error', {
          error_code: errorParam,
          error_type: errorParam,
          path: route.path,
          flow: 'web_oauth_callback',
        });
      } else {
        error.value = 'Authentication failed. Missing exchange code.';
        reportAuthError('oauth_callback_client_error', {
          error_type: 'missing_exchange_code',
          error_message: error.value,
          path: route.path,
          flow: 'web_oauth_callback',
        });
      }
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      return;
    }

    const authResponse = await $fetch<{
      user: { family_group_id?: number | null };
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/google/exchange', {
      method: 'POST',
      body: { code: exchangeCode },
    });

    await authStore.setAuth({
      user: authResponse.user,
      accessToken: authResponse.accessToken,
      refreshToken: authResponse.refreshToken,
    });

    // Clear sensitive query params from the address bar
    await router.replace({ path: route.path, query: {} });

    if (!authResponse.user.family_group_id) {
      router.push('/registration/step-2');
    } else {
      router.push('/diary');
    }
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    const errorObj = err as { data?: { message?: string }; message?: string };
    error.value = errorObj.data?.message || errorObj.message || 'Authentication failed. Please try again.';
    reportAuthError('oauth_callback_client_error', {
      error_type: 'unexpected',
      error_message: error.value,
      path: route.path,
      flow: 'web_oauth_callback',
    });
    setTimeout(() => {
      router.push('/login');
    }, 3000);
  }
});

const getErrorMessage = (errorParam: string): string => {
  const errorMessages: Record<string, string> = {
    'invalid_state': 'Invalid authentication state. Please try again.',
    'no_code': 'Authorization code not received. Please try again.',
    'no_email': 'Email not available from Google account.',
    'server_error': 'Server error during authentication.',
    'oauth_failed': 'Google authentication failed. Please try again.'
  };
  return errorMessages[errorParam] || 'Authentication failed. Please try again.';
};
</script>
