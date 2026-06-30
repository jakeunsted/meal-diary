import { describe, it, expect } from 'vitest';
import { ValidationError } from 'sequelize';
import { User } from '../associations.ts';

describe('User Model', () => {
  it('should build a valid user that passes validation', async () => {
    const user = User.build({
      username: 'vitest_test_create',
      email: 'vitest_test_create@example.com',
      password_hash: 'hashedpassword123',
    });

    await expect(user.validate()).resolves.not.toThrow();

    const userJson = user.toJSON();
    expect(userJson.username).toBe('vitest_test_create');
    expect(userJson.email).toBe('vitest_test_create@example.com');
  });

  it('should require a username', async () => {
    const user = User.build({
      email: 'vitest_test_require_username@example.com',
      password_hash: 'hashedpassword123',
    } as never);

    await expect(user.validate()).rejects.toThrow(ValidationError);
  });

  it('should require an email', async () => {
    const user = User.build({
      username: 'vitest_test_require_email',
      password_hash: 'hashedpassword123',
    } as never);

    await expect(user.validate()).rejects.toThrow(ValidationError);
  });

  it('should declare unique indexes on username, email and google_id', () => {
    const indexes = User.options.indexes ?? [];

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ unique: true, fields: ['username'] }),
        expect.objectContaining({ unique: true, fields: ['email'] }),
        expect.objectContaining({ unique: true, fields: ['google_id'] }),
      ])
    );
  });

  it('should allow accounts without a password (Google-only users)', async () => {
    const user = User.build({
      username: 'vitest_test_google_only',
      email: 'vitest_test_google_only@example.com',
      google_id: 'google-123',
    });

    await expect(user.validate()).resolves.not.toThrow();
  });

  it('should allow long avatar URLs (e.g. Google profile picture links)', async () => {
    const user = User.build({
      username: 'vitest_test_long_avatar',
      email: 'vitest_test_long_avatar@example.com',
      avatar_url: `https://lh3.googleusercontent.com/a/${'x'.repeat(400)}`,
    });

    await expect(user.validate()).resolves.not.toThrow();
  });
});
