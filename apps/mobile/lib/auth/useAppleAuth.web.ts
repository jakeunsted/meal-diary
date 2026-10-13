import { useCallback, useState } from 'react';

import { ApiError } from '@/lib/api/errors';
import { isAppleWebCancel, signInWithAppleWeb } from '@/lib/auth/appleWeb';
import { useAuthStore } from '@/lib/auth/authStore';
import { completeAppleSignIn } from '@/lib/auth/completeAppleSignIn';
import type { User } from '@/types/api';

export function useAppleAuth() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithApple = useCallback(async (): Promise<User> => {
    setIsLoading(true);
    setError(null);

    try {
      const credential = await signInWithAppleWeb();
      return await completeAppleSignIn(
        {
          idToken: credential.idToken,
          nonce: credential.rawNonce,
          givenName: credential.givenName,
          familyName: credential.familyName,
        },
        setAuth
      );
    } catch (err) {
      if (isAppleWebCancel(err)) {
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
