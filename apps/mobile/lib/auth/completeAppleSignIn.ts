import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import type { AuthResponse, User } from '@/types/api';

type SetAuth = ReturnType<typeof useAuthStore.getState>['setAuth'];

interface AppleSignInPayload {
  idToken: string;
  nonce: string;
  givenName?: string | null;
  familyName?: string | null;
}

/** Exchange a Sign in with Apple identity token for Meal Diary session tokens. */
export async function completeAppleSignIn(
  payload: AppleSignInPayload,
  setAuth: SetAuth
): Promise<User> {
  const response = await apiFetch<AuthResponse>('/auth/apple/verify-token', {
    method: 'POST',
    body: {
      idToken: payload.idToken,
      nonce: payload.nonce,
      ...(payload.givenName ? { givenName: payload.givenName } : {}),
      ...(payload.familyName ? { familyName: payload.familyName } : {}),
    },
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
