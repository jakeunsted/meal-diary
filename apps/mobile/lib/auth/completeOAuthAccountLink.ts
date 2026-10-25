import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import type { AuthResponse, User } from '@/types/api';

type SetAuth = ReturnType<typeof useAuthStore.getState>['setAuth'];

export async function completeOAuthAccountLink(
  linkToken: string,
  password: string,
  setAuth: SetAuth
): Promise<User> {
  const response = await apiFetch<AuthResponse>('/auth/oauth/link', {
    method: 'POST',
    body: { linkToken, password },
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
