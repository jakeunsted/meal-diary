import { describe, it, expect } from 'vitest';
import { Model } from 'sequelize';
import RefreshToken, { type RefreshTokenAttributes } from '../RefreshToken.model.ts';
import User, { type UserAttributes } from '../User.model.ts';
import { Op } from 'sequelize';

describe('RefreshToken Model', () => {
  it('should create a refresh token', async () => {
    // Create a test user first
    const user = await User.create({
      email: 'vitest_test_refresh_token1@example.com',
      username: 'vitest_test_refresh_token1',
      password_hash: 'hashedpassword',
      first_name: 'Test',
      last_name: 'User'
    }) as User & UserAttributes;

    const tokenData = {
      token: 'vitest_test_refresh_token1',
      user_id: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      is_revoked: false
    };

    const refreshToken = await RefreshToken.create(tokenData) as RefreshToken & RefreshTokenAttributes;

    expect(refreshToken).toBeInstanceOf(Model);
    expect(refreshToken.token).toBe(tokenData.token);
    expect(refreshToken.user_id).toBe(user.id);
    expect(refreshToken.is_revoked).toBe(false);
    expect(refreshToken.expires_at).toBeInstanceOf(Date);
  });

  it('should enforce unique tokens', async () => {
    // Create a test user
    const user = await User.create({
      email: 'vitest_test_refresh_token2@example.com',
      username: 'vitest_test_refresh_token2',
      password_hash: 'hashedpassword',
      first_name: 'Test',
      last_name: 'User'
    }) as User & UserAttributes;

    const tokenData = {
      token: 'vitest_test_refresh_token2',
      user_id: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      is_revoked: false
    };

    // Create first token
    await RefreshToken.create(tokenData);

    // Try to create another token with the same value
    await expect(RefreshToken.create(tokenData)).rejects.toThrow();
  });

  it('should enforce user_id foreign key constraint', async () => {
    const tokenData = {
      token: 'vitest_test_refresh_token3',
      user_id: 999, // Non-existent user ID
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      is_revoked: false
    };

    await expect(RefreshToken.create(tokenData)).rejects.toThrow();
  });

  it('should handle token expiration', async () => {
    // Create a test user
    const user = await User.create({
      email: 'vitest_test_refresh_token6@example.com',
      username: 'vitest_test_refresh_token6',
      password_hash: 'hashedpassword',
      first_name: 'Test',
      last_name: 'User'
    }) as User & UserAttributes;

    // Create an expired token
    const expiredToken = await RefreshToken.create({
      token: 'vitest_test_refresh_token_expired',
      user_id: user.id,
      expires_at: new Date(Date.now() - 1000), // Expired 1 second ago
      is_revoked: false
    }) as RefreshToken & RefreshTokenAttributes;

    // Try to find the token
    const foundToken = await RefreshToken.findOne({
      where: {
        token: 'vitest_test_refresh_token_expired',
        expires_at: {
          [Op.gt]: new Date()
        }
      }
    });

    expect(foundToken).toBeNull();
  });
});
