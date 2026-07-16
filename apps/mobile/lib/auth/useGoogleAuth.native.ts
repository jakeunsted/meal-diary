import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useCallback, useState } from 'react';

import { env } from '@/constants/env';
import { ApiError } from '@/lib/api/errors';
import { useAuthStore } from '@/lib/auth/authStore';
import { completeGoogleSignIn } from '@/lib/auth/completeGoogleSignIn';
import type { User } from '@/types/api';

let isConfigured = false;

function ensureGoogleSignInConfigured() {
  if (isConfigured || !env.googleWebClientId) {
    return;
  }

  // webClientId is required so the native SDK returns an idToken the API can verify.
  GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    offlineAccess: false,
  });
  isConfigured = true;
}

export function useGoogleAuth() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = useCallback(async (): Promise<User> => {
    if (!env.isGoogleConfigured) {
      throw new Error('Google Sign-In is not configured');
    }

    setIsLoading(true);
    setError(null);

    try {
      ensureGoogleSignInConfigured();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        throw new Error('Google sign-in was cancelled');
      }

      const idToken = response.data.idToken;
      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      return await completeGoogleSignIn(idToken, setAuth);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('Google sign-in was cancelled');
      }

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
  }, [setAuth]);

  return {
    signInWithGoogle,
    isLoading,
    error,
    isGoogleConfigured: env.isGoogleConfigured,
  };
}
