import { describe, it, expect, vi, beforeEach } from 'vitest';
import User from '../../db/models/User.model.ts';
import { createUser } from '../user.service.ts';

const validInput = {
  username: 'newuser',
  email: 'New@Example.com',
  password: 'password123',
  terms_accepted: true,
};

beforeEach(() => {
  vi.restoreAllMocks();
  // No existing user with the same username/email
  vi.spyOn(User, 'findOne').mockResolvedValue(null);
});

describe('createUser', () => {
  it('throws when username, email, or password is missing', async () => {
    await expect(
      createUser({ ...validInput, username: '' })
    ).rejects.toThrow('Username, email, and password are required');
  });

  it('throws when the terms have not been accepted', async () => {
    await expect(
      createUser({ ...validInput, terms_accepted: false })
    ).rejects.toThrow(
      'Acceptance of the terms of service and privacy policy is required'
    );

    await expect(
      createUser({ ...validInput, terms_accepted: undefined })
    ).rejects.toThrow(
      'Acceptance of the terms of service and privacy policy is required'
    );
  });

  it('stores terms_accepted_at when the terms are accepted', async () => {
    const create = vi.spyOn(User, 'create').mockResolvedValue({
      id: 1,
      toJSON() {
        return { id: 1, username: 'newuser', email: 'new@example.com' };
      },
    } as never);

    const result = await createUser(validInput);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'newuser',
        email: 'new@example.com',
        terms_accepted_at: expect.any(Date),
      })
    );
    expect(result.user).not.toHaveProperty('password_hash');
  });

  it('throws when a user with the same username or email exists', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue({ id: 99 } as never);

    await expect(createUser(validInput)).rejects.toThrow(
      'User with this username or email already exists'
    );
  });
});
