import type { FetchOptions } from 'ofetch';
import { useToast } from '~/composables/useToast';
import { handleAutoLogout } from '~/composables/useAuth';
import { useAuthStore } from '~/stores/auth';
import { isTokenExpired } from '~/composables/useJWT';
import { useAuth } from '~/composables/useAuth';
import {
  extractErrorMessage,
  isAuthError,
  isSessionExpiredError,
  isRetryableAuthError,
  getHttpStatusCode,
} from '~/utils/httpError';
import { runWithTokenRefreshLock } from '~/utils/tokenRefresh';
import type { ApiResponse } from '~/types/Api';

interface ApiOptions extends FetchOptions {
  /** When true, errors are thrown without showing a global toast */
  silent?: boolean;
}

/**
 * Get default error message based on status code.
 * Used to humanise raw HTTP status codes for toasts.
 */
const getDefaultMessage = (statusCode: number): string => {
  switch (statusCode) {
    case 400: return 'Bad Request';
    case 401: return 'Unauthorized';
    case 403: return 'Forbidden';
    case 404: return 'Not Found';
    case 500: return 'Server Error';
    case 502: return 'Bad Gateway';
    case 503: return 'Service Unavailable';
    default:  return `Server Error (${statusCode})`;
  }
};

/**
 * Return a display-ready error message, falling back to a status-code
 * default when the message is generic / empty.
 */
const resolveErrorMessage = (error: unknown): string => {
  // ofetch sometimes surfaces _data on the response object
  const e = error as any;
  if (e?.response?._data?.message && typeof e.response._data.message === 'string') {
    return e.response._data.message;
  }
  if (e?.data && typeof e.data === 'string') return e.data;

  const generic = ['fetch failed', 'network request failed', 'failed to fetch', '<no response>'];
  const base = extractErrorMessage(error);
  const baseLower = base.toLowerCase();
  if (!base || generic.some(g => baseLower.includes(g))) {
    const status = getHttpStatusCode(error);
    if (status) return getDefaultMessage(status);
    const statusMessage = e?.statusMessage;
    if (statusMessage && statusMessage !== 'Server Error') return statusMessage;
    return 'Network error. Please check your connection.';
  }
  return base;
};

/**
 * Apply rotated tokens returned by the Nuxt server (via authenticatedFetch)
 * to the client auth store so the client never holds stale tokens after a
 * server-side refresh.
 */
const applyRefreshedTokensFromResponse = async (
  response: unknown,
  authStore: ReturnType<typeof useAuthStore>
): Promise<void> => {
  const res = response as ApiResponse<unknown> | null;
  if (!res?.headers) return;
  const newAccess = res.headers['x-new-access-token'];
  const newRefresh = res.headers['x-new-refresh-token'];
  if (newAccess && newRefresh && authStore.user) {
    console.log('[Token Debug] applyRefreshedTokensFromResponse: applying rotated tokens from server response');
    await authStore.setAuth({
      user: authStore.user,
      accessToken: newAccess,
      refreshToken: newRefresh,
    });
  }
};

/**
 * Composable for making API calls with automatic error handling.
 * Wraps $fetch and:
 * - Proactively refreshes expired access tokens before each request
 * - Applies any server-rotated tokens from response headers
 * - Retries once on a recoverable 401 (token-rotation race)
 * - Triggers auto-logout only on genuine session-expired errors
 */
export const useApi = () => {
  const { showError } = useToast();
  const authStore = useAuthStore();
  const { refreshTokens } = useAuth();

  const ensureFreshTokens = async (url: string): Promise<void> => {
    const isRefreshEndpoint = url.includes('/auth/refresh-token');
    if (isRefreshEndpoint) return;
    if (!authStore.accessToken || !authStore.refreshToken) return;

    const expired = isTokenExpired(authStore.accessToken);
    console.log(`[Token Debug] ensureFreshTokens: url=${url} accessTokenExpired=${expired}`);
    if (!expired) return;

    console.log('[Token Debug] ensureFreshTokens: starting token refresh');
    try {
      await runWithTokenRefreshLock(async () => {
        await refreshTokens();
      });
      console.log('[Token Debug] ensureFreshTokens: token refresh succeeded');
    } catch (err: unknown) {
      console.error('[Token Debug] ensureFreshTokens: token refresh failed', {
        statusCode: getHttpStatusCode(err),
        message: extractErrorMessage(err),
        isSessionExpired: isSessionExpiredError(err),
      });
      if (isSessionExpiredError(err)) {
        await handleAutoLogout();
      }
      throw err;
    }
  };

  const buildHeaders = (options?: FetchOptions): Record<string, string> => {
    const existing = (options?.headers as Record<string, string> | undefined) ?? {};
    const headers: Record<string, string> = { ...existing };
    // Always stamp the latest tokens from the store so post-refresh requests
    // carry the new credentials even when the caller pre-set headers.
    if (authStore.accessToken) {
      headers['Authorization'] = `Bearer ${authStore.accessToken}`;
    }
    if (authStore.refreshToken) {
      headers['x-refresh-token'] = authStore.refreshToken;
    }
    return headers;
  };

  const api = async <T = any>(url: string, options?: ApiOptions): Promise<T> => {
    const { silent = false, ...fetchOptions } = options ?? {};

    try {
      await ensureFreshTokens(url);

      const result = await $fetch<T>(url, {
        ...fetchOptions,
        headers: buildHeaders(fetchOptions),
      } as any);

      // Sync any server-rotated tokens back into the client store.
      await applyRefreshedTokensFromResponse(result, authStore);

      return result;
    } catch (error: unknown) {
      if ((error as any)?.name === 'AbortError' || (error as any)?.cause?.name === 'AbortError') {
        throw error;
      }

      const statusCode = getHttpStatusCode(error);
      const errorMessage = resolveErrorMessage(error);
      const rawMessage = extractErrorMessage(error);
      console.error('[Token Debug] useApi catch:', {
        url,
        statusCode,
        rawMessage,
        errorMessage,
        isRetryable: isRetryableAuthError(error),
        isAuth: isAuthError(error),
        isSessionExpired: isSessionExpiredError(error),
      });

      // Retryable 401: server rotated tokens mid-flight; client store now has
      // fresher tokens (via SSE or a parallel request) — retry once.
      if (isRetryableAuthError(error)) {
        console.log('[Token Debug] useApi: retrying after rotation-race 401');
        try {
          const result = await $fetch<T>(url, {
            ...fetchOptions,
            headers: buildHeaders(fetchOptions),
          } as any);
          await applyRefreshedTokensFromResponse(result, authStore);
          return result;
        } catch (retryErr: unknown) {
          console.error('[Token Debug] useApi: retry also failed', {
            statusCode: getHttpStatusCode(retryErr),
            message: extractErrorMessage(retryErr),
          });
          // Fall through to session-expired handling below.
        }
      }

      if (isAuthError(error)) {
        console.error('[Token Debug] useApi: auth error — isSessionExpired:', isSessionExpiredError(error));
        if (isSessionExpiredError(error)) {
          await handleAutoLogout();
        }
      } else if (!silent) {
        showError(errorMessage);
      }

      throw error;
    }
  };

  return { api };
};
