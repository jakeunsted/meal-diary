import { ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { useAuthStore } from '~/stores/auth';
import { useApi } from '~/composables/useApi';
import { useRouter } from 'vue-router';

interface GoogleAuthResponse {
  user: {
    id: number;
    email: string;
    username: string;
    first_name?: string;
    last_name?: string;
    family_group_id?: number;
    avatar_url?: string;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Composable for Google authentication
 * Handles both native (Capacitor) and web OAuth flows
 */
export const useGoogleAuth = () => {
  const authStore = useAuthStore();
  const router = useRouter();
  const { api } = useApi();
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  let isInitialized = false;

  /**
   * Initialize the Social Login plugin with Google configuration
   * This should be called early in the app lifecycle
   */
  const initialize = async () => {
    if (isInitialized || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      const config = useRuntimeConfig();
      
      // For native platforms, we need the webClientId
      // This should match GOOGLE_CLIENT_ID from backend
      const webClientId = config.public.googleClientId || '';

      if (!webClientId) {
        console.warn('[Google Auth] GOOGLE_CLIENT_ID not configured. Native Google Sign-In may not work.');
        return;
      }

      await SocialLogin.initialize({
        google: {
          webClientId: webClientId,
        },
      });

      isInitialized = true;
      console.log('[Google Auth] Plugin initialized successfully');
    } catch (err) {
      console.error('[Google Auth] Failed to initialize plugin:', err);
    }
  };

  /**
   * Sign in with Google
   * Uses native plugin on mobile, web OAuth on browser
   */
  const signInWithGoogle = async (): Promise<void> => {
    try {
      isLoading.value = true;
      error.value = null;

      // Check if running on native platform
      if (Capacitor.isNativePlatform()) {
        // Initialize if not already done
        await initialize();

        // Use native Google Sign-In
        const result = await SocialLogin.login({
          provider: 'google',
          options: {
            scopes: ['email', 'profile'],
          },
        });

        if (result.provider !== 'google') {
          throw new Error('Unexpected provider response');
        }

        const googleResult = result.result;

        // Check if we got an ID token (online mode) or server auth code (offline mode)
        if ('responseType' in googleResult && googleResult.responseType === 'offline') {
          throw new Error('Offline mode not supported. Please use online mode.');
        }

        // Extract idToken from online response
        const idToken = (googleResult as { idToken?: string }).idToken;

        if (!idToken) {
          throw new Error('No ID token received from Google');
        }

        // Verify token with backend
        const authResponse = await api<GoogleAuthResponse>('/api/auth/google/verify-token', {
          method: 'POST',
          body: {
            idToken: idToken,
          },
        });

        // Store auth data
        await authStore.setAuth({
          user: authResponse.user,
          accessToken: authResponse.accessToken,
          refreshToken: authResponse.refreshToken,
        });

        // Determine redirect based on family group status
        if (!authResponse.user.family_group_id) {
          await router.push('/registration/step-2');
        } else {
          await router.push('/diary');
        }
      } else {
        // Web platform - use existing OAuth redirect flow
        const config = useRuntimeConfig();
        const baseUrl = config.public.baseUrl || '';
        window.location.href = `${baseUrl}/api/auth/google`;
      }
    } catch (err: any) {
      console.error('[Google Auth] Sign in error:', err);
      error.value = err.data?.message || err.message || 'Google authentication failed. Please try again.';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    signInWithGoogle,
    isLoading,
    error,
    initialize,
  };
};
