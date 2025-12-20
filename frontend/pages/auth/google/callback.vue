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

// Nuxt auto-imports: definePageMeta, useRoute, useRouter, ref, onMounted
definePageMeta({
  layout: false
});

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const error = ref('');

onMounted(async () => {
  try {
    // Check if this is a direct callback from Google (with code and state)
    // or a redirect from the API (with accessToken, refreshToken, and user)
    const code = String(route.query.code || '');
    const state = String(route.query.state || '');
    const accessToken = String(route.query.accessToken || '');
    const refreshToken = String(route.query.refreshToken || '');
    const userParam = String(route.query.user || '');

    // If we have code and state, this is a direct callback from Google
    // Forward it to the API backend
    if (code && state) {
      const config = useRuntimeConfig();
      const baseUrl = config.public.baseUrl;
      
      // Forward to API backend callback endpoint
      // The API will process the OAuth callback and redirect back to /auth/google-callback with tokens
      window.location.href = `${baseUrl}/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      return;
    }

    // Otherwise, this should be a redirect from the API with tokens
    if (!accessToken || !refreshToken || !userParam) {
      // Check if there's an error in the query
      const errorParam = String(route.query.error || '');
      if (errorParam) {
        error.value = getErrorMessage(errorParam);
      } else {
        error.value = 'Authentication failed. Missing tokens.';
      }
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      return;
    }

    // Parse user data
    let userData;
    try {
      userData = JSON.parse(decodeURIComponent(userParam));
    } catch (parseError) {
      throw new Error('Failed to parse user data');
    }

    // Store auth data
    await authStore.setAuth({
      user: userData,
      accessToken: decodeURIComponent(accessToken),
      refreshToken: decodeURIComponent(refreshToken)
    });

    // Determine redirect based on family group status
    if (!userData.family_group_id) {
      router.push('/registration/step-2');
    } else {
      router.push('/diary');
    }
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    const errorObj = err as { data?: { message?: string }; message?: string };
    error.value = errorObj.data?.message || errorObj.message || 'Authentication failed. Please try again.';
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
