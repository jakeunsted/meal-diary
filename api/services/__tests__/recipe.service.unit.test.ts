import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Op } from 'sequelize';

const recipeFindAll = vi.fn();
const recipeFindByPk = vi.fn();
const recipeCreate = vi.fn();
const recipeDestroy = vi.fn();
const ingredientBulkCreate = vi.fn();
const ingredientDestroy = vi.fn();
const dailyMealUpdate = vi.fn();
const dailyMealEntryUpdate = vi.fn();
const familyGroupFindByPk = vi.fn();
const assertCanCreateRecipe = vi.fn();
const sequelizeQuery = vi.fn();
const transaction = { commit: vi.fn(), rollback: vi.fn() };

vi.mock('../../db/models/index.ts', () => ({
  default: {
    transaction: vi.fn(async () => transaction),
    query: (...args: unknown[]) => sequelizeQuery(...args),
  },
}));

vi.mock('../entitlements.service.ts', () => ({
  assertCanCreateRecipe: (...args: unknown[]) => assertCanCreateRecipe(...args),
}));

vi.mock('../../db/models/associations.ts', () => ({
  FamilyGroup: {
    findByPk: (...args: unknown[]) => familyGroupFindByPk(...args),
  },
  Recipe: {
    findAll: (...args: unknown[]) => recipeFindAll(...args),
    findByPk: (...args: unknown[]) => recipeFindByPk(...args),
    create: (...args: unknown[]) => recipeCreate(...args),
    destroy: (...args: unknown[]) => recipeDestroy(...args),
  },
  RecipeIngredient: {
    bulkCreate: (...args: unknown[]) => ingredientBulkCreate(...args),
    destroy: (...args: unknown[]) => ingredientDestroy(...args),
  },
  DailyMeal: {
    update: (...args: unknown[]) => dailyMealUpdate(...args),
  },
  DailyMealEntry: {
    update: (...args: unknown[]) => dailyMealEntryUpdate(...args),
  },
}));

import { createRecipe, deleteRecipe, getRecipesByFamilyGroup, updateRecipe } from '../recipe.service.ts';

beforeEach(() => {
  vi.clearAllMocks();
  transaction.commit.mockReset();
  transaction.rollback.mockReset();
});

describe('createRecipe', () => {
  it('locks the family and recounts before inserting the recipe', async () => {
    familyGroupFindByPk.mockResolvedValue({ dataValues: { id: 4 } });
    assertCanCreateRecipe.mockResolvedValue({});
    recipeCreate.mockResolvedValue({ dataValues: { id: 8 } });
    recipeFindByPk.mockResolvedValue({ id: 8, name: 'Soup' });

    const result = await createRecipe({
      family_group_id: 4,
      created_by: 5,
      name: 'Soup',
    });

    expect(familyGroupFindByPk).toHaveBeenCalledWith(4, expect.objectContaining({
      transaction,
      lock: 'UPDATE',
    }));
    expect(assertCanCreateRecipe).toHaveBeenCalledWith(4, 5, transaction);
    expect(familyGroupFindByPk.mock.invocationCallOrder[0]).toBeLessThan(
      assertCanCreateRecipe.mock.invocationCallOrder[0]
    );
    expect(assertCanCreateRecipe.mock.invocationCallOrder[0]).toBeLessThan(
      recipeCreate.mock.invocationCallOrder[0]
    );
    expect(transaction.commit).toHaveBeenCalled();
    expect(result).toEqual({ id: 8, name: 'Soup' });
  });

  it('does not insert a recipe when the recount rejects the cap', async () => {
    familyGroupFindByPk.mockResolvedValue({ dataValues: { id: 4 } });
    assertCanCreateRecipe.mockRejectedValue(new Error('limit'));

    await expect(createRecipe({
      family_group_id: 4,
      created_by: 5,
      name: 'Soup',
    })).rejects.toThrow('limit');

    expect(recipeCreate).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();
  });
});

describe('getRecipesByFamilyGroup', () => {
  it('adds a case-insensitive name filter when search is provided', async () => {
    recipeFindAll.mockResolvedValue([]);

    await getRecipesByFamilyGroup(4, 'Soup');

    expect(recipeFindAll).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        family_group_id: 4,
        name: { [Op.iLike]: '%Soup%' },
      },
    }));
  });

  it('does not filter by name when search is omitted', async () => {
    recipeFindAll.mockResolvedValue([]);

    await getRecipesByFamilyGroup(4);

    expect(recipeFindAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { family_group_id: 4 },
    }));
  });
});

describe('updateRecipe', () => {
  const existing = {
    dataValues: {
      id: 8,
      name: 'Old name',
      description: 'Old description',
      instructions: 'Old instructions',
      portions: 2,
    },
    update: vi.fn(),
  };

  it('replaces ingredients when a new list is provided', async () => {
    recipeFindByPk
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ id: 8, name: 'New name' });

    const updated = await updateRecipe(8, {
      name: 'New name',
      ingredients: [{ name: 'Onion', quantity: 1, unit: 'pc' }],
    });

    expect(ingredientDestroy).toHaveBeenCalledWith({
      where: { recipe_id: 8 },
      transaction,
    });
    expect(ingredientBulkCreate).toHaveBeenCalledWith(
      [{ recipe_id: 8, name: 'Onion', quantity: 1, unit: 'pc' }],
      { transaction }
    );
    expect(transaction.commit).toHaveBeenCalled();
    expect(updated).toEqual({ id: 8, name: 'New name' });
  });

  it('leaves ingredients untouched when the update omits them', async () => {
    recipeFindByPk
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ id: 8 });

    await updateRecipe(8, { portions: 4 });

    expect(ingredientDestroy).not.toHaveBeenCalled();
    expect(ingredientBulkCreate).not.toHaveBeenCalled();
    expect(existing.update).toHaveBeenCalledWith(
      expect.objectContaining({ portions: 4, name: 'Old name' }),
      { transaction }
    );
  });

  it('rolls back when the recipe does not exist', async () => {
    recipeFindByPk.mockResolvedValue(null);

    await expect(updateRecipe(8, { name: 'Missing' })).rejects.toThrow('Recipe not found');
    expect(transaction.rollback).toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();
  });
});

describe('deleteRecipe', () => {
  it('clears meal references, then removes ingredients and the recipe', async () => {
    await deleteRecipe(8);

    expect(dailyMealUpdate).toHaveBeenCalledWith(
      { breakfast: '' },
      { where: { breakfast_recipe_id: 8 }, transaction }
    );
    expect(dailyMealUpdate).toHaveBeenCalledWith(
      { lunch: '' },
      { where: { lunch_recipe_id: 8 }, transaction }
    );
    expect(dailyMealUpdate).toHaveBeenCalledWith(
      { dinner: '' },
      { where: { dinner_recipe_id: 8 }, transaction }
    );
    expect(sequelizeQuery).toHaveBeenCalledWith(
      'UPDATE daily_meals SET breakfast_recipe_id = NULL WHERE breakfast_recipe_id = $1',
      { bind: [8], transaction }
    );
    expect(sequelizeQuery).toHaveBeenCalledWith(
      'UPDATE daily_meals SET lunch_recipe_id = NULL WHERE lunch_recipe_id = $1',
      { bind: [8], transaction }
    );
    expect(sequelizeQuery).toHaveBeenCalledWith(
      'UPDATE daily_meals SET dinner_recipe_id = NULL WHERE dinner_recipe_id = $1',
      { bind: [8], transaction }
    );
    expect(dailyMealEntryUpdate).toHaveBeenCalledWith(
      { dish: '', recipe_id: null },
      { where: { recipe_id: 8 }, transaction }
    );
    expect(ingredientDestroy).toHaveBeenCalledWith({
      where: { recipe_id: 8 },
      transaction,
    });
    expect(recipeDestroy).toHaveBeenCalledWith({
      where: { id: 8 },
      transaction,
    });
    expect(transaction.commit).toHaveBeenCalled();
  });
});
