import { describe, expect, it } from 'vitest';
import {
  AUTH_RETRY_MESSAGE,
  extractEntitlementError,
  extractErrorMessage,
  getHttpStatusCode,
  isAuthError,
  isNetworkError,
  isRetryableAuthError,
  isSessionExpiredError,
  toApiHttpError,
} from './httpError';

describe('http error helpers', () => {
  it('reads status and message from nested error shapes', () => {
    const error = {
      data: { message: 'Nope', statusCode: 422 },
    };

    expect(getHttpStatusCode(error)).toBe(422);
    expect(extractErrorMessage(error)).toBe('Nope');
    expect(toApiHttpError(error)).toEqual({ statusCode: 422, message: 'Nope' });
    expect(getHttpStatusCode(null)).toBeUndefined();
    expect(toApiHttpError('nope')).toEqual({ statusCode: 500, message: 'An error occurred' });
  });

  it('extracts an entitlement payload from either nesting level', () => {
    expect(extractEntitlementError({
      data: {
        data: {
          code: 'ENTITLEMENT_REQUIRED',
          feature: 'recipes',
          upgradeUrl: '/plans',
          plan: 'free',
        },
      },
    })).toEqual({
      code: 'ENTITLEMENT_REQUIRED',
      feature: 'recipes',
      upgradeUrl: '/plans',
      plan: 'free',
    });
    expect(extractEntitlementError({ message: 'nope' })).toBeNull();
    expect(extractEntitlementError(null)).toBeNull();
  });

  it('treats 401 and token-shaped 403s as auth errors', () => {
    expect(isAuthError({ status: 401, message: 'forbidden for another reason' })).toBe(true);
    expect(isAuthError({ statusCode: 403, message: 'Invalid token' })).toBe(true);
    expect(isAuthError({ statusCode: 403, message: 'Not allowed' })).toBe(false);
  });

  it('separates network failures, expired sessions, and retryable rotation', () => {
    const offline = { message: 'Failed to fetch' };
    expect(isNetworkError(offline)).toBe(true);
    expect(isNetworkError({ status: 500, message: 'Failed to fetch' })).toBe(false);
    expect(isSessionExpiredError(offline)).toBe(false);
    expect(isSessionExpiredError({ message: 'Invalid or expired refresh token' })).toBe(true);
    expect(isRetryableAuthError({ status: 401, message: AUTH_RETRY_MESSAGE })).toBe(true);
    expect(isRetryableAuthError({ status: 403, message: AUTH_RETRY_MESSAGE })).toBe(false);
  });
});
