import { env } from '@/constants/env';
import type { ApiErrorBody } from '@/lib/api/errors';
import { ApiError } from '@/lib/api/errors';
import { isSessionExpiredError } from '@/lib/auth/httpError';
import { isTokenExpired } from '@/lib/auth/jwt';
import { refreshTokens } from '@/lib/auth/refreshTokens';
import { runWithTokenRefreshLock } from '@/lib/auth/tokenRefreshLock';
import { clearAuthState, getAccessToken, getRefreshToken } from '@/lib/auth/tokenStorage';
import type { AuthResponse } from '@/types/api';

export { ApiError } from '@/lib/api/errors';
export type { ApiErrorBody } from '@/lib/api/errors';

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Attach the bearer token and refresh on 401. Defaults to true. */
  auth?: boolean;
}

let sessionExpiredHandler: (() => void) | null = null;

async function syncAuthStoreFromRefresh(response: AuthResponse): Promise<void> {
  const { useAuthStore } = await import('@/lib/auth/authStore');
  useAuthStore.setState({
    status: 'signedIn',
    user: response.user,
    entitlements: response.entitlements ?? null,
  });
}

async function handleSessionExpired(): Promise<void> {
  await clearAuthState();
  const { useAuthStore } = await import('@/lib/auth/authStore');
  await useAuthStore.getState().clearSession();
  sessionExpiredHandler?.();
}

/** Called when a 401 could not be recovered by refreshing the token. */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

async function ensureFreshTokens(path: string): Promise<void> {
  if (path.includes('/auth/refresh-token')) return;

  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();
  if (!accessToken || !refreshToken) return;
  if (!isTokenExpired(accessToken)) return;

  try {
    await runWithTokenRefreshLock(async () => {
      const response = await refreshTokens();
      await syncAuthStoreFromRefresh(response);
    });
  } catch (error) {
    if (isSessionExpiredError(error)) {
      await handleSessionExpired();
    }
    throw error;
  }
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return {};
  }
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, headers, auth = true, ...rest } = options;
  const url = `${env.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;

  if (auth) {
    await ensureFreshTokens(path);
  }

  const performRequest = async (accessToken: string | null): Promise<Response> => {
    return fetch(url, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(headers ?? {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await performRequest(auth ? await getAccessToken() : null);

  if (auth && response.status === 401) {
    try {
      await runWithTokenRefreshLock(async () => {
        const refreshed = await refreshTokens();
        await syncAuthStoreFromRefresh(refreshed);
      });
      response = await performRequest(await getAccessToken());
    } catch {
      await handleSessionExpired();
    }
  }

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    const message = errorBody.message ?? `API request failed: ${response.status}`;
    throw new ApiError(response.status, message, errorBody);
  }

  return response.json() as Promise<T>;
}
