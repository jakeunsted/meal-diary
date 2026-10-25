import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

process.env.JWT_ACCESS_SECRET = 'unit-test-secret';
process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret';
delete process.env.POSTHOG_KEY;

vi.mock('../../services/auth.service.ts', () => ({
  authenticateUser: vi.fn(),
  refreshUserTokens: vi.fn(),
  revokeRefreshToken: vi.fn(),
  generateOAuthState: vi.fn(),
  exchangeGoogleCode: vi.fn(),
  findOrCreateGoogleUser: vi.fn(),
  createOAuthExchangeCode: vi.fn(),
  exchangeOAuthCode: vi.fn(),
  completeOAuthAccountLink: vi.fn(),
}));

vi.mock('../../services/passwordReset.service.ts', () => ({
  requestPasswordReset: vi.fn(),
  completePasswordReset: vi.fn(),
  INVALID_RESET_LINK_MESSAGE: 'Reset link is invalid or has expired',
  PASSWORD_REQUIREMENTS_MESSAGE: 'Password does not meet requirements',
}));

vi.mock('../../services/authResponse.service.ts', () => ({
  buildAuthResponse: vi.fn(async (user, tokens) => ({
    user: { ...user, has_password: true },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  })),
}));

import User from '../../db/models/User.model.ts';
import { PasswordAccountLinkRequiredError } from '../../services/passwordLinkError.ts';
import * as AuthService from '../../services/auth.service.ts';
import { buildAuthResponse } from '../../services/authResponse.service.ts';
import { completePasswordReset, requestPasswordReset } from '../../services/passwordReset.service.ts';
import {
  exchangeGoogleOAuthCode,
  forgotPassword,
  handleGoogleCallback,
  initiateGoogleAuth,
  login,
  logout,
  refreshToken,
  resetPassword,
  validateToken,
} from '../auth/auth.controller.ts';

const mockRequest = (body: Record<string, unknown>, user?: unknown) =>
  ({ body, user, ip: '127.0.0.1' }) as unknown as Request;

const mockResponse = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }) as unknown as Response;

const fakeUser = {
  id: 1,
  email: 'vitest_test_login@example.com',
  username: 'vitest_test_loginuser',
  family_group_id: null,
};

const fakeTokens = {
  accessToken: 'fake-access-token',
  refreshToken: 'fake-refresh-token',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Auth Controller', () => {
  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      vi.mocked(AuthService.authenticateUser).mockResolvedValue({
        user: fakeUser,
        tokens: fakeTokens,
      } as never);

      const req = mockRequest({
        email: 'vitest_test_login@example.com',
        password: 'testPassword123',
      });
      const res = mockResponse();

      await login(req, res);

      expect(AuthService.authenticateUser).toHaveBeenCalledWith({
        email: 'vitest_test_login@example.com',
        password: 'testPassword123',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: 'vitest_test_login@example.com',
            username: 'vitest_test_loginuser',
          }),
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        })
      );
    });

    it('should return 400 if email or password is missing', async () => {
      const req = mockRequest({ email: 'vitest_test_login@example.com' });
      const res = mockResponse();

      await login(req, res);

      expect(AuthService.authenticateUser).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email and password are required',
      });
    });

    it('should return 401 for invalid credentials', async () => {
      vi.mocked(AuthService.authenticateUser).mockRejectedValue(
        new Error('Invalid credentials')
      );

      const req = mockRequest({
        email: 'vitest_test_login_invalid@example.com',
        password: 'wrongPassword',
      });
      const res = mockResponse();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid credentials',
      });
    });

    it('hides database authentication failures from the client', async () => {
      vi.mocked(AuthService.authenticateUser).mockRejectedValue(
        new Error('password authentication failed for user "postgres"')
      );

      const req = mockRequest({
        email: 'vitest_test_login@example.com',
        password: 'testPassword123',
      });
      const res = mockResponse();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      const body = vi.mocked(res.json).mock.calls[0][0] as { message: string };
      expect(body.message).toBe(
        'Internal server error. We are trying our best to restore the service.'
      );
      expect(body.message).not.toMatch(/postgres|password authentication/i);
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh tokens with valid refresh token', async () => {
      vi.mocked(AuthService.refreshUserTokens).mockResolvedValue({
        user: fakeUser,
        tokens: fakeTokens,
      } as never);

      const req = mockRequest({ refreshToken: 'valid-refresh-token' });
      const res = mockResponse();

      await refreshToken(req, res);

      expect(AuthService.refreshUserTokens).toHaveBeenCalledWith(
        'valid-refresh-token'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        })
      );
    });

    it('should return 400 if refresh token is missing', async () => {
      const req = mockRequest({});
      const res = mockResponse();

      await refreshToken(req, res);

      expect(AuthService.refreshUserTokens).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Refresh token is required',
      });
    });

    it('should return 403 for invalid refresh token', async () => {
      vi.mocked(AuthService.refreshUserTokens).mockRejectedValue(
        new Error('Invalid or expired refresh token')
      );

      const req = mockRequest({ refreshToken: 'invalid_token' });
      const res = mockResponse();

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid or expired refresh token',
      });
    });
  });

  describe('logout', () => {
    it('should successfully logout and revoke refresh token', async () => {
      vi.mocked(AuthService.revokeRefreshToken).mockResolvedValue(undefined);

      const req = mockRequest({ refreshToken: 'token-to-revoke' });
      const res = mockResponse();

      await logout(req, res);

      expect(AuthService.revokeRefreshToken).toHaveBeenCalledWith(
        'token-to-revoke'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });

    it('should handle logout without refresh token', async () => {
      vi.mocked(AuthService.revokeRefreshToken).mockResolvedValue(undefined);

      const req = mockRequest({});
      const res = mockResponse();

      await logout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });

    it('should return 500 if revoking the token fails', async () => {
      vi.mocked(AuthService.revokeRefreshToken).mockRejectedValue(
        new Error('db down')
      );

      const req = mockRequest({ refreshToken: 'token-to-revoke' });
      const res = mockResponse();

      await logout(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Server error during logout',
      });
    });
  });

  describe('forgotPassword', () => {
    it('returns the same message for any email', async () => {
      vi.mocked(requestPasswordReset).mockResolvedValue(undefined);

      const req = mockRequest({ email: 'user@example.com' });
      const res = mockResponse();

      await forgotPassword(req, res);

      expect(requestPasswordReset).toHaveBeenCalledWith('user@example.com');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'If an account exists for that email, we sent password reset instructions.',
      });
    });

    it('returns 400 when email is missing', async () => {
      const req = mockRequest({});
      const res = mockResponse();

      await forgotPassword(req, res);

      expect(requestPasswordReset).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Email is required' });
    });
  });

  describe('resetPassword', () => {
    it('updates the password when the token is accepted', async () => {
      vi.mocked(completePasswordReset).mockResolvedValue(undefined);

      const req = mockRequest({ token: 'raw-token', password: 'NewPassword1!' });
      const res = mockResponse();

      await resetPassword(req, res);

      expect(completePasswordReset).toHaveBeenCalledWith('raw-token', 'NewPassword1!');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Password updated' });
    });

    it('returns 400 when the reset link is invalid', async () => {
      vi.mocked(completePasswordReset).mockRejectedValue(
        new Error('Reset link is invalid or has expired')
      );

      const req = mockRequest({ token: 'bad-token', password: 'NewPassword1!' });
      const res = mockResponse();

      await resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Reset link is invalid or has expired',
      });
    });
  });

  describe('validateToken', () => {
    it('returns the sanitized user when the token middleware attached one', async () => {
      const req = mockRequest({}, {
        id: 1,
        toJSON: () => ({
          id: 1,
          email: 'ada@example.com',
          username: 'ada',
          password_hash: 'secret',
        }),
      });
      const res = mockResponse();

      await validateToken(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        valid: true,
        user: expect.objectContaining({
          id: 1,
          email: 'ada@example.com',
          has_password: true,
        }),
      });
    });
  });

  describe('initiateGoogleAuth', () => {
    const originalClientId = process.env.GOOGLE_CLIENT_ID;

    afterEach(() => {
      if (originalClientId === undefined) {
        delete process.env.GOOGLE_CLIENT_ID;
      } else {
        process.env.GOOGLE_CLIENT_ID = originalClientId;
      }
    });

    it('redirects to Google and stores the oauth state', async () => {
      process.env.GOOGLE_CLIENT_ID = 'google-client';
      vi.mocked(AuthService.generateOAuthState).mockReturnValue('state-1');
      const req = mockRequest({});
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        cookie: vi.fn(),
        redirect: vi.fn(),
      } as unknown as Response;

      await initiateGoogleAuth(req, res);

      expect(res.cookie).toHaveBeenCalledWith('oauth_state', 'state-1', expect.objectContaining({
        httpOnly: true,
      }));
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('state=state-1'));
    });

    it('returns 500 when Google OAuth is not configured', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      const req = mockRequest({});
      const res = mockResponse();

      await initiateGoogleAuth(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Google OAuth not configured' });
    });
  });

  describe('handleGoogleCallback', () => {
    it('redirects with an exchange code after a valid callback', async () => {
      vi.spyOn(User, 'findOne').mockResolvedValue(null as never);
      vi.mocked(AuthService.exchangeGoogleCode).mockResolvedValue({
        profile: { email: 'ada@example.com' },
      } as never);
      vi.mocked(AuthService.findOrCreateGoogleUser).mockResolvedValue({ id: 4 } as never);
      vi.mocked(AuthService.createOAuthExchangeCode).mockResolvedValue('exchange-1' as never);
      const req = {
        query: { code: 'auth-code', state: 'state-1' },
        cookies: { oauth_state: 'state-1' },
      } as unknown as Request;
      const res = {
        redirect: vi.fn(),
        clearCookie: vi.fn(),
      } as unknown as Response;

      await handleGoogleCallback(req, res);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      expect(res.clearCookie).toHaveBeenCalledWith('oauth_state');
      expect(res.redirect).toHaveBeenCalledWith(
        `${frontendUrl}/auth/google/callback?exchangeCode=exchange-1`
      );
    });

    it('redirects to login when the state does not match', async () => {
      const req = {
        query: { code: 'auth-code', state: 'other' },
        cookies: { oauth_state: 'state-1' },
      } as unknown as Request;
      const res = { redirect: vi.fn() } as unknown as Response;

      await handleGoogleCallback(req, res);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      expect(res.redirect).toHaveBeenCalledWith(`${frontendUrl}/login?error=invalid_state`);
    });

    it('sends a password account to the link form without an exchange code', async () => {
      vi.spyOn(User, 'findOne').mockResolvedValue({ id: 4 } as never);
      vi.mocked(AuthService.exchangeGoogleCode).mockResolvedValue({
        profile: { email: 'ada@example.com' },
      } as never);
      vi.mocked(AuthService.findOrCreateGoogleUser).mockRejectedValue(
        new PasswordAccountLinkRequiredError('raw-link')
      );
      const req = {
        query: { code: 'auth-code', state: 'state-1' },
        cookies: { oauth_state: 'state-1' },
      } as unknown as Request;
      const res = {
        redirect: vi.fn(),
        clearCookie: vi.fn(),
      } as unknown as Response;

      await handleGoogleCallback(req, res);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      expect(res.redirect).toHaveBeenCalledWith(`${frontendUrl}/login?linkToken=raw-link`);
      expect(AuthService.createOAuthExchangeCode).not.toHaveBeenCalled();
    });
  });

  describe('exchangeGoogleOAuthCode', () => {
    it('returns a session for a valid exchange code', async () => {
      vi.mocked(AuthService.exchangeOAuthCode).mockResolvedValue({
        user: fakeUser,
        tokens: fakeTokens,
      } as never);
      const req = mockRequest({ code: 'exchange-1' });
      const res = mockResponse();

      await exchangeGoogleOAuthCode(req, res);

      expect(buildAuthResponse).toHaveBeenCalledWith(fakeUser, fakeTokens);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 400 for a missing or expired code', async () => {
      const missing = mockResponse();
      await exchangeGoogleOAuthCode(mockRequest({}), missing);
      expect(missing.status).toHaveBeenCalledWith(400);

      vi.mocked(AuthService.exchangeOAuthCode).mockRejectedValueOnce(new Error('User not found'));
      const expired = mockResponse();
      await exchangeGoogleOAuthCode(mockRequest({ code: 'gone' }), expired);
      expect(expired.status).toHaveBeenCalledWith(400);
      expect(expired.json).toHaveBeenCalledWith({ message: 'Invalid or expired exchange code' });
    });
  });
});
