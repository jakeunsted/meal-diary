import { ref } from 'vue';

/**
 * Google sign-in for the website. The browser follows the existing OAuth
 * redirect; the Expo app verifies Google ID tokens against the API directly.
 */
export const useGoogleAuth = () => {
  const isLoading = ref(false);

  const signInWithGoogle = async (): Promise<void> => {
    isLoading.value = true;
    window.location.href = '/api/auth/google';
  };

  return {
    signInWithGoogle,
    isLoading,
  };
};
