import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

process.env.JWT_ACCESS_SECRET = 'unit-test-secret';
process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret';
delete process.env.POSTHOG_KEY;

vi.mock('../../services/auth.service.ts', () => ({
  authenticateUser: vi.fn(),
  refreshUserTokens: vi.fn(),
  revokeRefreshToken: vi.fn(),
}));

vi.mock('../../services/authResponse.service.ts', () => ({
  buildAuthResponse: vi.fn(async (user, tokens) => ({
    user: { ...user, has_password: true },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  })),
}));

import * as AuthService from '../../services/auth.service.ts';
import { login, refreshToken, logout } from '../auth/auth.controller.ts';

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
});
