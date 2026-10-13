import { computed, ref } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useApi } from '~/composables/useApi';
import { useRouter } from 'vue-router';
import { isAppleCancel, signInWithApplePopup } from '~/utils/appleSignIn';

interface AppleAuthResponse {
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
 * Sign in with Apple on the website via Apple's JavaScript popup.
 * Hidden unless APPLE_SERVICES_ID is set.
 */
export const useAppleAuth = () => {
  const authStore = useAuthStore();
  const router = useRouter();
  const { api } = useApi();
  const config = useRuntimeConfig();
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isConfigured = computed(() => Boolean(config.public.appleServicesId));

  const signInWithApple = async (): Promise<'cancelled' | 'success'> => {
    const clientId = config.public.appleServicesId;
    if (!clientId) {
      throw new Error('Sign in with Apple is not configured');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const credential = await signInWithApplePopup(clientId);
      const authResponse = await api<AppleAuthResponse>('/api/auth/apple/verify-token', {
        method: 'POST',
        body: {
          idToken: credential.idToken,
          nonce: credential.rawNonce,
          ...(credential.givenName ? { givenName: credential.givenName } : {}),
          ...(credential.familyName ? { familyName: credential.familyName } : {}),
        },
      });

      await authStore.setAuth({
        user: authResponse.user,
        accessToken: authResponse.accessToken,
        refreshToken: authResponse.refreshToken,
      });

      if (!authResponse.user.family_group_id) {
        await router.push('/registration/step-2');
      } else {
        await router.push('/diary');
      }

      return 'success';
    } catch (err: any) {
      if (isAppleCancel(err)) {
        return 'cancelled';
      }

      error.value = err.data?.message || err.message || 'Apple sign-in failed. Please try again.';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    signInWithApple,
    isLoading,
    error,
    isConfigured,
  };
};
