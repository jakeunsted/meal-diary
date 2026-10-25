import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/auth.service.ts', () => ({
  authenticateWithGoogleToken: vi.fn(),
}));

vi.mock('../../utils/posthog.ts', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
  sanitizeErrorForAnalytics: vi.fn(() => ({
    error_type: 'Error',
    error_message: 'sanitized',
  })),
}));

vi.mock('../../utils/otelLogs.ts', () => ({
  trackAuthLog: vi.fn().mockResolvedValue(undefined),
}));

import * as AuthService from '../../services/auth.service.ts';
import { trackAuthLog } from '../../utils/otelLogs.ts';
import { trackEvent } from '../../utils/posthog.ts';
import { PasswordAccountLinkRequiredError } from '../../services/passwordLinkError.ts';
import { verifyGoogleToken } from '../auth/googleTokenVerification.controller.ts';

const mockResponse = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }) as unknown as Response;

const mockRequest = (body: Record<string, unknown> = {}) =>
  ({ body }) as unknown as Request;

const user = {
  id: 4,
  email: 'ada@example.com',
  username: 'ada',
  first_name: 'Ada',
  last_name: 'Lovelace',
  family_group_id: 2,
  avatar_url: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-02',
  password_hash: 'secret',
};

describe('verifyGoogleToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the user without a password and both tokens', async () => {
    vi.mocked(AuthService.authenticateWithGoogleToken).mockResolvedValue({
      user,
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
      isNewUser: false,
    } as never);
    const res = mockResponse();

    await verifyGoogleToken(mockRequest({ idToken: 'google-token' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      user: {
        id: 4,
        email: 'ada@example.com',
        username: 'ada',
        first_name: 'Ada',
        last_name: 'Lovelace',
        family_group_id: 2,
        avatar_url: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-02',
      },
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    expect(trackEvent).toHaveBeenCalledWith('4', 'google_token_verification_success', { is_new_user: false });
    expect(trackEvent).toHaveBeenCalledWith('4', 'login_success', { auth_method: 'google' });
  });

  it('returns 400 when the token is missing', async () => {
    const res = mockResponse();

    await verifyGoogleToken(mockRequest({}), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(trackAuthLog).toHaveBeenCalledWith(
      expect.anything(),
      'google_token_verification_failure',
      expect.objectContaining({ reason: 'missing_token' })
    );
  });

  it('maps invalid, unverified, and infrastructure service errors', async () => {
    vi.mocked(AuthService.authenticateWithGoogleToken).mockRejectedValueOnce(new Error('Invalid token'));
    const invalid = mockResponse();
    await verifyGoogleToken(mockRequest({ idToken: 'bad' }), invalid);
    expect(invalid.status).toHaveBeenCalledWith(401);

    vi.mocked(AuthService.authenticateWithGoogleToken).mockRejectedValueOnce(new Error('Email not verified'));
    const unverified = mockResponse();
    await verifyGoogleToken(mockRequest({ idToken: 'bad' }), unverified);
    expect(unverified.status).toHaveBeenCalledWith(400);

    vi.mocked(AuthService.authenticateWithGoogleToken).mockRejectedValueOnce(
      new Error('password authentication failed for user postgres')
    );
    const infrastructure = mockResponse();
    await verifyGoogleToken(mockRequest({ idToken: 'bad' }), infrastructure);
    expect(infrastructure.status).toHaveBeenCalledWith(500);
  });

  it('returns a password-link challenge instead of a session', async () => {
    vi.mocked(AuthService.authenticateWithGoogleToken).mockRejectedValueOnce(
      new PasswordAccountLinkRequiredError('raw-link')
    );
    const res = mockResponse();

    await verifyGoogleToken(mockRequest({ idToken: 'google-token' }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'This email already has a password',
      code: 'password_link_required',
      linkToken: 'raw-link',
    });
  });
});
