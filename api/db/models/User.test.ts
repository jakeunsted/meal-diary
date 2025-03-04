import { describe, it, expect } from 'vitest';
import { User } from '../db.ts';
import { ValidationError } from 'sequelize';

describe('User Model', () => {
  it('should create a new user successfully', async () => {
    const user = await User.create({
      username: 'vitest_test_create',
      email: 'vitest_test_create@example.com',
      password_hash: 'hashedpassword123'
    });
    const userJson = user.toJSON();
    expect(userJson).toBeDefined();
    expect(userJson.id).toBeDefined();
    expect(userJson.username).toBe('vitest_test_create');
    expect(userJson.email).toBe('vitest_test_create@example.com');
  }, 15000);

  it('should require a username', async () => {
    const incompleteData = {
      email: 'vitest_test_require_username@example.com',
      password_hash: 'hashedpassword123'
    };

    // Expect specifically a ValidationError for the null violation
    await expect(User.create(incompleteData as any)).rejects.toThrow(ValidationError);
  }, 15000);

  it('should require a unique username', async () => {
    // Create a user first
    await User.create({
      username: 'vitest_test_unique',
      email: 'vitest_test_unique@example.com',
      password_hash: 'hashedpassword123'
    });
    
    try {
      // Try to create another user with the same username
      await User.create({
        username: 'vitest_test_unique',
        email: 'vitest_test_unique_another@example.com',
        password_hash: 'hashedpassword456'
      });
      
      expect.fail('Should have thrown a validation error');
    } catch (error) {
      expect((error as ValidationError).message).toContain('Validation error');
    }
  }, 15000);

  it('should be able to delete a user', async () => {
    const user = await User.create({
      username: 'vitest_test_delete',
      email: 'vitest_test_delete@example.com',
      password_hash: 'hashedpassword123'
    });
    const userJson = user.toJSON();
    expect(userJson).toBeDefined();
    expect(userJson.id).toBeDefined();

    await user.destroy();
    const deletedUser = await User.findByPk(userJson.id);
    expect(deletedUser).toBeNull();
  }, 15000);
});
