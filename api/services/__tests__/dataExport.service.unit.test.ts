import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  User,
  FamilyGroup,
  MealDiary,
  ShoppingList,
  Recipe,
} from '../../db/models/associations.ts';
import { exportUserData } from '../dataExport.service.ts';

const userRow = (overrides: Record<string, unknown> = {}) => ({
  dataValues: { id: 1, family_group_id: 7, ...overrides },
  toJSON() {
    return {
      id: 1,
      username: 'jake',
      email: 'jake@example.com',
      password_hash: 'super-secret-hash',
      family_group_id: 7,
      ...overrides,
    };
  },
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('exportUserData', () => {
  it('throws when the user does not exist', async () => {
    vi.spyOn(User, 'findByPk').mockResolvedValue(null);
    await expect(exportUserData(1)).rejects.toThrow('User not found');
  });

  it('returns all top-level keys and never includes password_hash', async () => {
    vi.spyOn(User, 'findByPk').mockResolvedValue(userRow() as never);
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue({
      toJSON: () => ({ id: 7, name: 'Reeves Mead' }),
    } as never);
    vi.spyOn(Recipe, 'findAll').mockResolvedValue([
      { toJSON: () => ({ id: 1, name: 'Soup' }) },
    ] as never);
    vi.spyOn(MealDiary, 'findAll').mockResolvedValue([
      { toJSON: () => ({ id: 1, week_start_date: '2026-06-08' }) },
    ] as never);
    vi.spyOn(ShoppingList, 'findAll').mockResolvedValue([
      { toJSON: () => ({ id: 1, family_group_id: 7 }) },
    ] as never);

    const result = await exportUserData(1);

    expect(Object.keys(result).sort()).toEqual(
      ['exportedAt', 'familyGroup', 'mealDiaries', 'recipes', 'shoppingLists', 'user'].sort()
    );
    expect(result.exportedAt).toEqual(expect.any(String));
    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.user.email).toBe('jake@example.com');
    expect(result.familyGroup).toMatchObject({ name: 'Reeves Mead' });
    expect(result.recipes).toHaveLength(1);
    expect(result.mealDiaries).toHaveLength(1);
    expect(result.shoppingLists).toHaveLength(1);
  });

  it('returns empty collections and null family for a user with no family group', async () => {
    vi.spyOn(User, 'findByPk').mockResolvedValue(
      userRow({ family_group_id: null }) as never
    );
    const familyFind = vi.spyOn(FamilyGroup, 'findByPk');
    const recipeFind = vi.spyOn(Recipe, 'findAll');

    const result = await exportUserData(1);

    expect(result.familyGroup).toBeNull();
    expect(result.recipes).toEqual([]);
    expect(result.mealDiaries).toEqual([]);
    expect(result.shoppingLists).toEqual([]);
    // No family group → no family-scoped queries at all
    expect(familyFind).not.toHaveBeenCalled();
    expect(recipeFind).not.toHaveBeenCalled();
    expect(result.user).not.toHaveProperty('password_hash');
  });
});
