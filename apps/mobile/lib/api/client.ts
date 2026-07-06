import { env } from '@/constants/env';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/lib/auth/tokenStorage';
import type { AuthResponse } from '@/types/api';

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Attach the bearer token and refresh on 401. Defaults to true. */
  auth?: boolean;
}

export interface ApiErrorBody {
  message?: string;
  code?: string;
  feature?: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  feature?: string;

  constructor(status: number, message: string, body?: ApiErrorBody) {
    super(message);
    this.status = status;
    this.code = body?.code;
    this.feature = body?.feature;
  }
}

let sessionExpiredHandler: (() => void) | null = null;

/** Called when a 401 could not be recovered by refreshing the token. */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

// Dedup concurrent refreshes so parallel queries only hit /auth/refresh-token once
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) return null;

        const response = await fetch(`${env.apiUrl}/auth/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return null;

        const data = (await response.json()) as AuthResponse;
        await setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
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
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      response = await performRequest(newAccessToken);
    } else {
      await clearTokens();
      sessionExpiredHandler?.();
    }
  }

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    const message = errorBody.message ?? `API request failed: ${response.status}`;
    throw new ApiError(response.status, message, errorBody);
  }

  return response.json() as Promise<T>;
}
