import { describe, it, expect } from 'vitest';
import { ValidationError } from 'sequelize';
import { User, RefreshToken } from '../associations.ts';

const REFRESH_TOKEN_TTL_MS = 28 * 24 * 60 * 60 * 1000;

describe('RefreshToken Model', () => {
  it('should build a valid refresh token that passes validation', async () => {
    const refreshToken = RefreshToken.build({
      token: 'vitest_test_refresh_token1',
      user_id: 1,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      is_revoked: false,
    });

    await expect(refreshToken.validate()).resolves.not.toThrow();

    const json = refreshToken.toJSON();
    expect(json.token).toBe('vitest_test_refresh_token1');
    expect(json.user_id).toBe(1);
    expect(json.is_revoked).toBe(false);
    expect(json.expires_at).toBeInstanceOf(Date);
  });

  it('should default is_revoked to false', () => {
    const refreshToken = RefreshToken.build({
      token: 'vitest_test_refresh_token_default',
      user_id: 1,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    } as never);

    expect(refreshToken.toJSON().is_revoked).toBe(false);
  });

  it('should require a token', async () => {
    const refreshToken = RefreshToken.build({
      user_id: 1,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      is_revoked: false,
    } as never);

    await expect(refreshToken.validate()).rejects.toThrow(ValidationError);
  });

  it('should require an expires_at date', async () => {
    const refreshToken = RefreshToken.build({
      token: 'vitest_test_refresh_token_no_expiry',
      user_id: 1,
      is_revoked: false,
    } as never);

    await expect(refreshToken.validate()).rejects.toThrow(ValidationError);
  });

  it('should declare tokens as unique', () => {
    expect(RefreshToken.getAttributes().token.unique).toBe(true);
  });

  it('should reference the users table via user_id', () => {
    const reference = RefreshToken.getAttributes().user_id.references;
    expect(reference).toBeDefined();
    expect((reference as { key?: string }).key).toBe('id');
  });

  it('should enforce one refresh token per user via a hasOne association', () => {
    expect(User.associations.refreshToken).toBeDefined();
    expect(User.associations.refreshToken.associationType).toBe('HasOne');
    expect(User.associations.refreshToken.foreignKey).toBe('user_id');

    expect(RefreshToken.associations.user).toBeDefined();
    expect(RefreshToken.associations.user.foreignKey).toBe('user_id');
  });
});
