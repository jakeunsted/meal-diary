import { describe, it, expect, vi, beforeEach } from 'vitest';
import sequelize from '../../db/models/index.ts';
import {
  User,
  FamilyGroup,
  ShoppingList,
  MealDiary,
  DailyMeal,
  ShoppingListCategory,
  ShoppingListItem,
  Recipe,
  RecipeIngredient,
  Subscription,
} from '../../db/models/associations.ts';
import {
  leaveFamilyGroup,
  transferFamilyGroupOwnership,
  deleteFamilyGroup,
} from '../familyGroup.service.ts';

const fakeGroup = (id: number, createdBy: number) =>
  ({ dataValues: { id, created_by: createdBy } });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('leaveFamilyGroup', () => {
  it('throws when the family group does not exist', async () => {
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue(null);

    await expect(leaveFamilyGroup(5, 1)).rejects.toThrow('Family group not found');
  });

  it('blocks the owner from leaving', async () => {
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue(fakeGroup(5, 1) as never);
    const update = vi.spyOn(User, 'update');

    await expect(leaveFamilyGroup(5, 1)).rejects.toThrow(
      'The family owner cannot leave'
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('unlinks a regular member, leaving shared data untouched', async () => {
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue(fakeGroup(5, 1) as never);
    const update = vi.spyOn(User, 'update').mockResolvedValue([1]);
    const groupDestroy = vi.spyOn(FamilyGroup, 'destroy');
    const diaryDestroy = vi.spyOn(MealDiary, 'destroy');

    await leaveFamilyGroup(5, 2);

    expect(update).toHaveBeenCalledWith(
      { family_group_id: null },
      { where: { id: 2, family_group_id: 5 } }
    );
    expect(groupDestroy).not.toHaveBeenCalled();
    expect(diaryDestroy).not.toHaveBeenCalled();
  });
});

describe('transferFamilyGroupOwnership', () => {
  it('only the owner can transfer', async () => {
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue(fakeGroup(5, 1) as never);

    await expect(transferFamilyGroupOwnership(5, 2, 3)).rejects.toThrow(
      'Only the family owner can transfer ownership'
    );
  });

  it('rejects transferring to yourself', async () => {
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue(fakeGroup(5, 1) as never);

    await expect(transferFamilyGroupOwnership(5, 1, 1)).rejects.toThrow(
      'You already own this family group'
    );
  });

  it('rejects a new owner who is not a member of the group', async () => {
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue(fakeGroup(5, 1) as never);
    vi.spyOn(User, 'findByPk').mockResolvedValue({
      dataValues: { id: 3, family_group_id: 99 },
    } as never);

    await expect(transferFamilyGroupOwnership(5, 1, 3)).rejects.toThrow(
      'The new owner must be a member of the family group'
    );
  });

  it('updates created_by for a valid transfer', async () => {
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue(fakeGroup(5, 1) as never);
    vi.spyOn(User, 'findByPk').mockResolvedValue({
      dataValues: { id: 3, family_group_id: 5 },
    } as never);
    const update = vi.spyOn(FamilyGroup, 'update').mockResolvedValue([1]);

    await transferFamilyGroupOwnership(5, 1, 3);

    expect(update).toHaveBeenCalledWith({ created_by: 3 }, { where: { id: 5 } });
  });
});

describe('deleteFamilyGroup', () => {
  const mockCascadeSpies = () => {
    vi.spyOn(MealDiary, 'findAll').mockResolvedValue([
      { dataValues: { id: 10 } },
    ] as never);
    vi.spyOn(ShoppingList, 'findAll').mockResolvedValue([
      { dataValues: { id: 20 } },
    ] as never);
    vi.spyOn(Recipe, 'findAll').mockResolvedValue([
      { dataValues: { id: 30 } },
    ] as never);
    return {
      dailyMeals: vi.spyOn(DailyMeal, 'destroy').mockResolvedValue(0),
      diaries: vi.spyOn(MealDiary, 'destroy').mockResolvedValue(0),
      items: vi.spyOn(ShoppingListItem, 'destroy').mockResolvedValue(0),
      categories: vi.spyOn(ShoppingListCategory, 'destroy').mockResolvedValue(0),
      lists: vi.spyOn(ShoppingList, 'destroy').mockResolvedValue(0),
      ingredients: vi.spyOn(RecipeIngredient, 'destroy').mockResolvedValue(0),
      recipes: vi.spyOn(Recipe, 'destroy').mockResolvedValue(0),
      subscriptions: vi.spyOn(Subscription, 'destroy').mockResolvedValue(0),
      unlink: vi.spyOn(User, 'update').mockResolvedValue([1]),
      group: vi.spyOn(FamilyGroup, 'destroy').mockResolvedValue(1),
    };
  };

  it('only the owner can delete', async () => {
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue(fakeGroup(5, 1) as never);
    const groupDestroy = vi.spyOn(FamilyGroup, 'destroy');

    await expect(deleteFamilyGroup(5, 2)).rejects.toThrow(
      'Only the family owner can delete the family group'
    );
    expect(groupDestroy).not.toHaveBeenCalled();
  });

  it('cascade-deletes everything and unlinks members for the owner', async () => {
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue(fakeGroup(5, 1) as never);
    vi.spyOn(sequelize, 'transaction').mockImplementation((async (
      callback: (t: unknown) => Promise<unknown>
    ) => callback({})) as never);
    const spies = mockCascadeSpies();

    await deleteFamilyGroup(5, 1);

    expect(spies.dailyMeals).toHaveBeenCalled();
    expect(spies.diaries).toHaveBeenCalled();
    expect(spies.items).toHaveBeenCalled();
    expect(spies.categories).toHaveBeenCalled();
    expect(spies.lists).toHaveBeenCalled();
    expect(spies.ingredients).toHaveBeenCalled();
    expect(spies.recipes).toHaveBeenCalled();
    expect(spies.subscriptions).toHaveBeenCalled();
    expect(spies.unlink).toHaveBeenCalledWith(
      { family_group_id: null },
      expect.objectContaining({ where: { family_group_id: 5 } })
    );
    expect(spies.group).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 } })
    );
  });
});
