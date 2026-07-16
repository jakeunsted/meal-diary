import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import type { AuthResponse, User } from '@/types/api';

type SetAuth = ReturnType<typeof useAuthStore.getState>['setAuth'];

/** Exchange a Google ID token for Meal Diary session tokens. */
export async function completeGoogleSignIn(
  idToken: string,
  setAuth: SetAuth
): Promise<User> {
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
}
