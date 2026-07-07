import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { queryClient } from '@/lib/api/queryClient';
import { isSessionExpiredError } from '@/lib/auth/httpError';
import { isTokenExpired } from '@/lib/auth/jwt';
import { refreshTokens } from '@/lib/auth/refreshTokens';
import { runWithTokenRefreshLock } from '@/lib/auth/tokenRefreshLock';
import { getAccessToken, getRefreshToken } from '@/lib/auth/tokenStorage';
import { useAuthStore } from '@/lib/auth/authStore';
import { mealDiaryKeys } from '@/lib/queries/mealDiary';

async function handleAppResume(): Promise<void> {
  const status = useAuthStore.getState().status;
  if (status !== 'signedIn') return;

  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();
  if (!accessToken || !refreshToken) return;
  if (!isTokenExpired(accessToken, 0)) {
    void queryClient.invalidateQueries({ queryKey: mealDiaryKeys.all });
    return;
  }

  try {
    await runWithTokenRefreshLock(async () => {
      const response = await refreshTokens();
      useAuthStore.setState({
        status: 'signedIn',
        user: response.user,
        entitlements: response.entitlements ?? null,
      });
      void queryClient.invalidateQueries({ queryKey: mealDiaryKeys.all });
    });
  } catch (error) {
    if (isSessionExpiredError(error)) {
      await useAuthStore.getState().clearSession();
    }
  }
}

export function useAuthResume(): void {
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          void handleAppResume();
        }
      };

      const handlePageShow = (event: PageTransitionEvent) => {
        if (event.persisted) {
          void handleAppResume();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('pageshow', handlePageShow);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pageshow', handlePageShow);
      };
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void handleAppResume();
      }
    });

    return () => subscription.remove();
  }, []);
}
