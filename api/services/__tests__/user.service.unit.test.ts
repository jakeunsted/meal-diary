import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import sequelize from '../../db/models/index.ts';
import User from '../../db/models/User.model.ts';
import FamilyGroup from '../../db/models/FamilyGroup.model.ts';
import Recipe from '../../db/models/Recipe.model.ts';
import RefreshToken from '../../db/models/RefreshToken.model.ts';
import { createUser, deleteUserAccount } from '../user.service.ts';
import * as FamilyGroupService from '../familyGroup.service.ts';

vi.mock('../familyGroup.service.ts', () => ({
  deleteFamilyGroupData: vi.fn(),
}));

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

  it('throws when the email format is invalid', async () => {
    await expect(
      createUser({ ...validInput, email: 'child' })
    ).rejects.toThrow('A valid email address is required');
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

describe('deleteUserAccount', () => {
  const passwordHash = bcrypt.hashSync('correct-password', 4);

  const fakeUserRow = (overrides: Record<string, unknown> = {}) => ({
    dataValues: { id: 1, password_hash: passwordHash, ...overrides },
    destroy: vi.fn().mockResolvedValue(undefined),
  });

  const mockTransaction = () =>
    vi
      .spyOn(sequelize, 'transaction')
      .mockImplementation((async (callback: (t: unknown) => Promise<unknown>) =>
        callback({})) as never);

  beforeEach(() => {
    // No family groups created by the user unless a test says otherwise
    vi.spyOn(FamilyGroup, 'findAll').mockResolvedValue([]);
  });

  it('throws when the user does not exist', async () => {
    vi.spyOn(User, 'findByPk').mockResolvedValue(null);

    await expect(deleteUserAccount(1, { password: 'x' })).rejects.toThrow('User not found');
  });

  it('requires a password for password accounts', async () => {
    vi.spyOn(User, 'findByPk').mockResolvedValue(fakeUserRow() as never);

    await expect(deleteUserAccount(1, {})).rejects.toThrow('Password confirmation is required');
  });

  it('rejects an incorrect password and deletes nothing', async () => {
    const user = fakeUserRow();
    vi.spyOn(User, 'findByPk').mockResolvedValue(user as never);

    await expect(deleteUserAccount(1, { password: 'wrong' })).rejects.toThrow('Password is incorrect');
    expect(user.destroy).not.toHaveBeenCalled();
  });

  it('requires typed DELETE confirmation for Google-only accounts', async () => {
    vi.spyOn(User, 'findByPk').mockResolvedValue(
      fakeUserRow({ password_hash: null }) as never
    );

    await expect(deleteUserAccount(1, { confirmation: 'delete please' })).rejects.toThrow(
      'Type DELETE to confirm account deletion'
    );
  });

  it('deletes a Google-only account with DELETE confirmation', async () => {
    const user = fakeUserRow({ password_hash: null });
    vi.spyOn(User, 'findByPk').mockResolvedValue(user as never);
    mockTransaction();
    const recipeUpdate = vi.spyOn(Recipe, 'update').mockResolvedValue([0] as never);
    const tokenDestroy = vi.spyOn(RefreshToken, 'destroy').mockResolvedValue(0);

    await deleteUserAccount(1, { confirmation: 'DELETE' });

    expect(recipeUpdate).toHaveBeenCalledWith(
      { created_by: null },
      expect.objectContaining({ where: { created_by: 1 } })
    );
    expect(tokenDestroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 1 } })
    );
    expect(user.destroy).toHaveBeenCalled();
  });

  it('blocks deletion when a created family group still has other members', async () => {
    const user = fakeUserRow();
    vi.spyOn(User, 'findByPk').mockResolvedValue(user as never);
    vi.spyOn(FamilyGroup, 'findAll').mockResolvedValue([
      { dataValues: { id: 5 } },
    ] as never);
    vi.spyOn(User, 'count').mockResolvedValue(2);

    await expect(deleteUserAccount(1, { password: 'correct-password' })).rejects.toThrow(
      'still has other members'
    );
    expect(user.destroy).not.toHaveBeenCalled();
  });

  it('cascade-deletes a family group the user created alone, then the user', async () => {
    const user = fakeUserRow();
    vi.spyOn(User, 'findByPk').mockResolvedValue(user as never);
    vi.spyOn(FamilyGroup, 'findAll').mockResolvedValue([
      { dataValues: { id: 5 } },
    ] as never);
    vi.spyOn(User, 'count').mockResolvedValue(0);
    mockTransaction();
    vi.spyOn(Recipe, 'update').mockResolvedValue([0] as never);
    vi.spyOn(RefreshToken, 'destroy').mockResolvedValue(0);

    await deleteUserAccount(1, { password: 'correct-password' });

    expect(FamilyGroupService.deleteFamilyGroupData).toHaveBeenCalledWith(5, expect.anything());
    expect(user.destroy).toHaveBeenCalled();
  });
});
