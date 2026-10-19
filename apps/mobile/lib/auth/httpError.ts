import { ApiError } from '@/lib/api/errors';

function extractErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '';
}

function networkErrorText(error: Error): string {
  const cause = error.cause instanceof Error ? error.cause.message : '';
  return `${error.message} ${cause}`.toLowerCase();
}

export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (
    error instanceof TypeError ||
    error.name === 'AbortError' ||
    error.name === 'TimeoutError'
  ) {
    return true;
  }
  const message = networkErrorText(error);
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('network error') ||
    message.includes('network connection was lost') ||
    message.includes('the internet connection appears to be offline') ||
    message.includes('load failed') ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('could not connect') ||
    message.includes('failed to connect') ||
    message.includes('connectexception') ||
    message.includes('connection refused') ||
    message.includes('econnrefused') ||
    message.includes('unable to resolve') ||
    message.includes('hostname') ||
    message.includes('connection reset') ||
    message.includes('connection abort') ||
    message.includes('aborted')
  );
}

const SESSION_EXPIRED_MESSAGES = [
  'invalid or expired refresh token',
  'refresh token has expired',
  'token has been revoked',
  'user not found',
  'refresh token is required',
  'failed to refresh token',
  'no refresh token available',
];

export function isSessionExpiredError(error: unknown): boolean {
  if (isNetworkError(error)) return false;

  if (error instanceof ApiError) {
    if (error.status === 401) return true;
    if (error.status === 403) {
      const message = error.message.toLowerCase();
      return SESSION_EXPIRED_MESSAGES.some((m) => message.includes(m));
    }
    return false;
  }

  const message = extractErrorMessage(error).toLowerCase();
  return SESSION_EXPIRED_MESSAGES.some((m) => message.includes(m));
}
