import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/auth.service.ts', () => ({
  authenticateWithAppleToken: vi.fn(),
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
import { trackEvent } from '../../utils/posthog.ts';
import { verifyAppleToken } from '../auth/appleTokenVerification.controller.ts';

const mockResponse = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }) as unknown as Response;

const mockRequest = (body: Record<string, unknown> = {}) =>
  ({ body }) as unknown as Request;

describe('verifyAppleToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trims a name and returns the session', async () => {
    vi.mocked(AuthService.authenticateWithAppleToken).mockResolvedValue({
      user: {
        id: 8,
        email: 'ada@example.com',
        username: 'ada',
        first_name: 'Ada',
        last_name: 'Lovelace',
        family_group_id: null,
        avatar_url: null,
        created_at: null,
        updated_at: null,
      },
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
      isNewUser: true,
    } as never);
    const res = mockResponse();

    await verifyAppleToken(mockRequest({
      idToken: 'apple-token',
      nonce: 'nonce-1',
      givenName: '  Ada  ',
      familyName: '   ',
    }), res);

    expect(AuthService.authenticateWithAppleToken).toHaveBeenCalledWith(
      'apple-token',
      'nonce-1',
      { givenName: '  Ada  ', familyName: undefined },
      undefined
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(trackEvent).toHaveBeenCalledWith('8', 'login_success', { auth_method: 'apple' });
  });

  it('returns 409 when the email is already linked to a different Apple account', async () => {
    vi.mocked(AuthService.authenticateWithAppleToken).mockRejectedValueOnce(
      new Error('Email already linked to a different Apple account')
    );
    const res = mockResponse();

    await verifyAppleToken(mockRequest({ idToken: 'token', nonce: 'nonce' }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Email already linked to a different Apple account',
    });
  });

  it('returns 400 when the token or nonce is missing', async () => {
    const res = mockResponse();

    await verifyAppleToken(mockRequest({ idToken: 'apple-token' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'ID token and nonce are required' });
  });

  it('maps an invalid nonce to 401 and an unexpected failure to 500', async () => {
    vi.mocked(AuthService.authenticateWithAppleToken).mockRejectedValueOnce(new Error('Invalid nonce'));
    const invalid = mockResponse();
    await verifyAppleToken(mockRequest({ idToken: 'token', nonce: 'bad' }), invalid);
    expect(invalid.status).toHaveBeenCalledWith(401);

    vi.mocked(AuthService.authenticateWithAppleToken).mockImplementationOnce(() => {
      throw { response: { status: 500 } };
    });
    const unexpected = mockResponse();
    await verifyAppleToken(mockRequest({ idToken: 'token', nonce: 'nonce' }), unexpected);
    expect(unexpected.status).toHaveBeenCalledWith(500);
  });
});
