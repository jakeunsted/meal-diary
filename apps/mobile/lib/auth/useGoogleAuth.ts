import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';

import { env } from '@/constants/env';
import { ApiError } from '@/lib/api/errors';
import { useAuthStore } from '@/lib/auth/authStore';
import { completeGoogleSignIn } from '@/lib/auth/completeGoogleSignIn';
import { rethrowPasswordLink } from '@/lib/auth/passwordLink';
import { getGoogleRedirectUri } from '@/lib/auth/googleRedirectUri';
import type { User } from '@/types/api';

WebBrowser.maybeCompleteAuthSession();

/** Web-only Google Sign-In via expo-auth-session. Native uses useGoogleAuth.native.ts. */
export function useGoogleAuth() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectUri = getGoogleRedirectUri();
  const webClientId = env.googleWebClientId || undefined;

  const [, , promptAsync] = Google.useIdTokenAuthRequest({
    webClientId,
    ...(redirectUri ? { redirectUri } : {}),
  });

  const signInWithGoogle = useCallback(async (): Promise<User> => {
    if (!env.isGoogleConfigured) {
      throw new Error('Google Sign-In is not configured');
    }

    setIsLoading(true);
    setError(null);

    if (__DEV__) {
      console.log('[Google Auth] redirectUri:', redirectUri);
    }

    try {
      const result = await promptAsync();

      if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('Google sign-in was cancelled');
      }

      if (result.type !== 'success') {
        throw new Error('Google sign-in failed');
      }

      const idToken = result.params.id_token;
      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      return await completeGoogleSignIn(idToken, setAuth);
    } catch (err) {
      rethrowPasswordLink(err);
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Google authentication failed. Please try again.';

      if (!message.toLowerCase().includes('cancelled')) {
        setError(message);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [promptAsync, redirectUri, setAuth]);

  return {
    signInWithGoogle,
    isLoading,
    error,
    isGoogleConfigured: env.isGoogleConfigured,
  };
}
