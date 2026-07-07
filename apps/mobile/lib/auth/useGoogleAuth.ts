import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { env } from '@/constants/env';
import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { useAuthStore } from '@/lib/auth/authStore';
import { getGoogleRedirectUri } from '@/lib/auth/googleRedirectUri';
import type { AuthResponse, User } from '@/types/api';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectUri = getGoogleRedirectUri();

  const [, , promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: env.googleWebClientId || undefined,
    androidClientId: env.googleAndroidClientId || env.googleWebClientId || undefined,
    redirectUri,
  });

  const signInWithGoogle = useCallback(async (): Promise<User> => {
    if (!env.isGoogleConfigured) {
      throw new Error('Google Sign-In is not configured');
    }

    setIsLoading(true);
    setError(null);

    if (__DEV__ && Platform.OS === 'web') {
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

      const response = await apiFetch<AuthResponse>('/auth/google/verify-token', {
        method: 'POST',
        body: { idToken },
        auth: false,
      });

      await setAuth({
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        entitlements: response.entitlements ?? null,
      });

      return response.user;
    } catch (err) {
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
  }, [promptAsync, setAuth]);

  return {
    signInWithGoogle,
    isLoading,
    error,
    isGoogleConfigured: env.isGoogleConfigured,
  };
}
