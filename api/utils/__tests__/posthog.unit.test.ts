import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { sanitizeErrorForAnalytics } from '../posthog.ts';

describe('sanitizeErrorForAnalytics', () => {
  it('classifies no email errors', () => {
    const result = sanitizeErrorForAnalytics(new Error('No email in Google profile'));
    expect(result.error_type).toBe('no_email');
    expect(result.error_message).toBe('No email in Google profile');
  });

  it('classifies token exchange errors from axios', () => {
    const error = new AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as never,
        data: {
          error: 'invalid_grant',
          error_description: 'Code was already redeemed.',
        },
      }
    );

    const result = sanitizeErrorForAnalytics(error);
    expect(result.error_type).toBe('token_exchange');
    expect(result.error_message).toContain('invalid_grant');
  });

  it('redacts email addresses from error messages', () => {
    const result = sanitizeErrorForAnalytics(
      new Error('User test@example.com already exists')
    );
    expect(result.error_message).toContain('[email]');
    expect(result.error_message).not.toContain('test@example.com');
  });

  it('classifies jwt configuration errors', () => {
    const result = sanitizeErrorForAnalytics(new Error('JWT secrets not configured'));
    expect(result.error_type).toBe('jwt_error');
  });

  it('classifies db validation errors', () => {
    const error = new Error('Validation error: value too long');
    error.name = 'SequelizeValidationError';
    const result = sanitizeErrorForAnalytics(error);
    expect(result.error_type).toBe('db_error');
  });

  it('classifies postgres varchar length errors', () => {
    const result = sanitizeErrorForAnalytics(
      new Error('value too long for type character varying(255)')
    );
    expect(result.error_type).toBe('db_error');
  });
});
