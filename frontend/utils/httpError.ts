/**
 * Shared typed error utilities for HTTP/API error handling.
 * Used across useApi, authenticatedFetch, and the global error-handler plugin.
 */

export interface ApiHttpError {
  statusCode: number;
  message: string;
}

/**
 * Broad interface for the variety of error shapes Nuxt/ofetch can produce.
 */
export interface HttpErrorLike {
  statusCode?: number;
  status?: number;
  message?: string;
  code?: string;
  feature?: string;
  data?: {
    message?: string;
    statusCode?: number;
    code?: string;
    feature?: string;
    upgradeUrl?: string;
    data?: {
      code?: string;
      feature?: string;
      upgradeUrl?: string;
      plan?: string;
    };
  };
  response?: { status?: number; data?: { message?: string } };
}

export interface EntitlementErrorData {
  code: 'ENTITLEMENT_REQUIRED';
  feature: string;
  upgradeUrl?: string;
  plan?: string;
}

/**
 * Extract entitlement error payload from API / Nuxt proxy errors.
 */
export function extractEntitlementError(error: unknown): EntitlementErrorData | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const e = error as HttpErrorLike;
  const payload = e.data?.data ?? e.data ?? e;

  if (payload?.code === 'ENTITLEMENT_REQUIRED' && payload.feature) {
    return {
      code: 'ENTITLEMENT_REQUIRED',
      feature: payload.feature,
      upgradeUrl: payload.upgradeUrl,
      plan: payload.plan,
    };
  }

  return null;
}

/**
 * Extract an HTTP status code from any error-like value.
 */
export function getHttpStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const e = error as HttpErrorLike;
  return (
    e.statusCode ??
    e.status ??
    e.data?.statusCode ??
    e.response?.status ??
    undefined
  );
}

/**
 * Extract a human-readable message from any error-like value.
 */
export function extractErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const e = error as HttpErrorLike;
  return (
    e.data?.message ??
    e.response?.data?.message ??
    e.message ??
    ''
  );
}

/**
 * Normalise any error into a plain ApiHttpError for uniform handling.
 */
export function toApiHttpError(error: unknown): ApiHttpError {
  return {
    statusCode: getHttpStatusCode(error) ?? 500,
    message: extractErrorMessage(error) || 'An error occurred',
  };
}

const TOKEN_AUTH_MESSAGES = [
  'invalid token',
  'expired token',
  'no token provided',
  'invalid or expired refresh token',
  'token refresh failed',
  'failed to refresh token',
  'token expired and refresh token was rotated',
];

/**
 * True when the error represents an authentication failure that the client
 * should handle (redirect to login or retry).
 *
 * Rules:
 * - 401 is always an auth error.
 * - 403 is an auth error only when the message indicates a token issue
 *   (avoids treating permission/RBAC 403s as session expiry).
 * - Specific auth-related messages in any status code are treated as auth errors.
 */
export function isAuthError(error: unknown): boolean {
  const status = getHttpStatusCode(error);
  const message = extractErrorMessage(error).toLowerCase();

  if (status === 401) return true;

  if (status === 403) {
    return TOKEN_AUTH_MESSAGES.some(m => message.includes(m));
  }

  return TOKEN_AUTH_MESSAGES.some(m => message.includes(m));
}

/**
 * True when the request failed before reaching the server (no HTTP status).
 * Common on mobile when the app resumes before the network is ready.
 */
export function isNetworkError(error: unknown): boolean {
  if (getHttpStatusCode(error) !== undefined) return false;
  const message = extractErrorMessage(error).toLowerCase();
  const networkPatterns = [
    'failed to fetch',
    'fetch failed',
    'network request failed',
    'network error',
    '<no response>',
    'load failed',
    'the internet connection appears to be offline',
  ];
  return networkPatterns.some(p => message.includes(p));
}

const SESSION_EXPIRED_MESSAGES = [
  'invalid or expired refresh token',
  'token refresh failed',
  'failed to refresh token',
  'no token provided',
  'no refresh token available',
];

/**
 * True when the session is definitively over and the user must log in again.
 * Triggers automatic logout.
 */
export function isSessionExpiredError(error: unknown): boolean {
  // Transient network failures must not be treated as an expired session.
  if (isNetworkError(error)) return false;

  const message = extractErrorMessage(error).toLowerCase();
  return SESSION_EXPIRED_MESSAGES.some(m => message.includes(m));
}

/**
 * The message the server emits when the refresh token has already been rotated
 * and the client should retry with its up-to-date tokens rather than logging out.
 */
export const AUTH_RETRY_MESSAGE = 'token expired and refresh token was rotated';

/**
 * True when a 401 was caused by a token-rotation race (the server already
 * issued new tokens) — the client should retry the request once using the
 * latest tokens from its store, not trigger logout.
 */
export function isRetryableAuthError(error: unknown): boolean {
  const status = getHttpStatusCode(error);
  if (status !== 401) return false;
  const message = extractErrorMessage(error).toLowerCase();
  return message.includes(AUTH_RETRY_MESSAGE);
}
