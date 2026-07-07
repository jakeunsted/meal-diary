import { env } from '@/constants/env';
import { ApiError } from '@/lib/api/errors';
import { isTokenExpired } from '@/lib/auth/jwt';
import { getAccessToken, getAuthState, getRefreshToken, setAuthState } from '@/lib/auth/tokenStorage';
import type { AuthResponse } from '@/types/api';

export async function refreshTokens(): Promise<AuthResponse> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new ApiError(401, 'No refresh token available');
  }

  const refreshTokenUsed = refreshToken;

  try {
    const response = await fetch(`${env.apiUrl}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshTokenUsed }),
    });

    if (!response.ok) {
      let message = `API request failed: ${response.status}`;
      try {
        const body = (await response.json()) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        // Non-JSON error body
      }
      throw new ApiError(response.status, message);
    }

    const data = (await response.json()) as AuthResponse;
    const stored = await getAuthState();
    const user = data.user ?? stored?.user;

    if (!user) {
      throw new ApiError(401, 'No user in refresh response');
    }

    await setAuthState({
      user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      entitlements: data.entitlements ?? stored?.entitlements ?? null,
    });

    return { ...data, user };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      const accessToken = await getAccessToken();
      const stored = await getAuthState();
      if (accessToken && !isTokenExpired(accessToken, 0) && stored?.user) {
        return {
          user: stored.user,
          accessToken,
          refreshToken: (await getRefreshToken()) ?? refreshTokenUsed,
          entitlements: stored.entitlements ?? undefined,
        };
      }
    }
    throw error;
  }
}
