import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { login, refreshToken, logout } from '../auth/auth.controller';
import User, { UserAttributes } from '../../db/models/User.model';
import RefreshToken from '../../db/models/RefreshToken.model';

describe('Auth Controller', () => {
  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Create test user
      const hashedPassword = await bcrypt.hash('testPassword123', 10);
      const testUser = await User.create({
        email: 'vitest_test_login@example.com',
        username: 'vitest_test_loginuser',
        password_hash: hashedPassword,
        first_name: 'Test',
        last_name: 'User'
      }) as User & UserAttributes;

      const req = {
        body: {
          email: 'vitest_test_login@example.com',
          password: 'testPassword123'
        }
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as Response;

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: 'vitest_test_login@example.com',
            username: 'vitest_test_loginuser'
          }),
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        })
      );
    });

    it('should return 400 if email or password is missing', async () => {
      const req = {
        body: {
          email: 'vitest_test_login@example.com'
        }
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as Response;

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email and password are required'
      });
    });

    it('should return 401 for invalid credentials', async () => {
      // Create test user
      const hashedPassword = await bcrypt.hash('testPassword123', 10);
      await User.create({
        email: 'vitest_test_login_invalid@example.com',
        username: 'vitest_test_login_invaliduser',
        password_hash: hashedPassword,
        first_name: 'Test',
        last_name: 'User'
      });

      const req = {
        body: {
          email: 'vitest_test_login_invalid@example.com',
          password: 'wrongPassword'
        }
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as Response;

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid credentials'
      });
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh tokens with valid refresh token', async () => {
      // Create test user and refresh token
      const testUser = await User.create({
        email: 'vitest_test_refresh@example.com',
        username: 'vitest_test_refreshuser',
        password_hash: 'dummy_hash',
        first_name: 'Test',
        last_name: 'User'
      }) as User & UserAttributes;

      const mockRefreshToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_REFRESH_SECRET || 'test_refresh_secret',
        { expiresIn: '7d' }
      );

      await RefreshToken.create({
        token: mockRefreshToken,
        user_id: testUser.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        is_revoked: false
      });

      const req = {
        body: {
          refreshToken: mockRefreshToken
        }
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as Response;

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        })
      );
    });

    it('should return 400 if refresh token is missing', async () => {
      const req = {
        body: {}
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as Response;

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Refresh token is required'
      });
    });

    it('should return 403 for invalid refresh token', async () => {
      const req = {
        body: {
          refreshToken: 'invalid_token'
        }
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as Response;

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid or expired refresh token'
      });
    });
  });

  describe('logout', () => {
    it('should successfully logout and revoke refresh token', async () => {
      // Create test user and refresh token
      const testUser = await User.create({
        email: 'vitest_test_logout@example.com',
        username: 'vitest_test_logoutuser',
        password_hash: 'dummy_hash',
        first_name: 'Test',
        last_name: 'User'
      }) as User & UserAttributes;

      const mockRefreshToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_REFRESH_SECRET || 'test_refresh_secret',
        { expiresIn: '7d' }
      );

      await RefreshToken.create({
        token: mockRefreshToken,
        user_id: testUser.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        is_revoked: false
      });

      const req = {
        body: {
          refreshToken: mockRefreshToken
        }
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as Response;

      await logout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Logged out successfully'
      });

      // Verify refresh token is deleted
      const deletedToken = await RefreshToken.findOne({
        where: { token: mockRefreshToken }
      });
      expect(deletedToken).toBeNull();
    });

    it('should handle logout without refresh token', async () => {
      const req = {
        body: {}
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as Response;

      await logout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Logged out successfully'
      });
    });
  });
}); 