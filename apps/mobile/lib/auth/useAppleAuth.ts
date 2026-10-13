import { useCallback, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { ApiError } from '@/lib/api/errors';
import { useAuthStore } from '@/lib/auth/authStore';
import { completeAppleSignIn } from '@/lib/auth/completeAppleSignIn';
import type { User } from '@/types/api';

function isAppleCancel(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ERR_REQUEST_CANCELED'
  );
}

export function useAppleAuth() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithApple = useCallback(async (): Promise<User> => {
    setIsLoading(true);
    setError(null);

    try {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
        { encoding: Crypto.CryptoEncoding.HEX }
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      return await completeAppleSignIn(
        {
          idToken: credential.identityToken,
          nonce: rawNonce,
          givenName: credential.fullName?.givenName,
          familyName: credential.fullName?.familyName,
        },
        setAuth
      );
    } catch (err) {
      if (isAppleCancel(err)) {
        throw err;
      }

      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Apple sign-in failed. Please try again.';

      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setAuth]);

  return {
    signInWithApple,
    isLoading,
    error,
  };
}
