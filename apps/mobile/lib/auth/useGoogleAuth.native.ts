import { useCallback, useState } from 'react';

import { env } from '@/constants/env';
import { ApiError } from '@/lib/api/errors';
import { useAuthStore } from '@/lib/auth/authStore';
import { completeGoogleSignIn } from '@/lib/auth/completeGoogleSignIn';
import { isNativeGoogleSignInAvailable } from '@/lib/auth/isNativeGoogleSignInAvailable';
import type { User } from '@/types/api';

interface GoogleSignInModule {
  GoogleSignin: {
    configure: (options: { webClientId: string; offlineAccess: boolean }) => void;
    hasPlayServices: (options: { showPlayServicesUpdateDialog: boolean }) => Promise<void>;
    signIn: () => Promise<{ type: string; data: { idToken: string | null } }>;
  };
  isErrorWithCode: (error: unknown) => error is { code: string };
  isSuccessResponse: (
    response: unknown
  ) => response is { type: 'success'; data: { idToken: string | null } };
  statusCodes: { SIGN_IN_CANCELLED: string };
}

let isConfigured = false;
let googleSignInModule: GoogleSignInModule | null | undefined;

function getGoogleSignInModule(): GoogleSignInModule {
  if (googleSignInModule === undefined) {
    if (!isNativeGoogleSignInAvailable()) {
      googleSignInModule = null;
    } else {
      // Lazy require so Expo Go never loads the TurboModule at import time.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      googleSignInModule = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
    }
  }

  if (!googleSignInModule) {
    throw new Error(
      'Google Sign-In requires a development build. Run `npx expo run:android` from apps/mobile.'
    );
  }

  return googleSignInModule;
}

function ensureGoogleSignInConfigured() {
  if (isConfigured || !env.googleWebClientId) {
    return;
  }

  const { GoogleSignin } = getGoogleSignInModule();

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

    let isErrorWithCode: GoogleSignInModule['isErrorWithCode'] | undefined;
    let statusCodes: GoogleSignInModule['statusCodes'] | undefined;

    try {
      const googleSignIn = getGoogleSignInModule();
      isErrorWithCode = googleSignIn.isErrorWithCode;
      statusCodes = googleSignIn.statusCodes;
      const { GoogleSignin, isSuccessResponse } = googleSignIn;

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
      if (
        isErrorWithCode &&
        statusCodes &&
        isErrorWithCode(err) &&
        err.code === statusCodes.SIGN_IN_CANCELLED
      ) {
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
    isGoogleConfigured: env.isGoogleConfigured && isNativeGoogleSignInAvailable(),
  };
}
