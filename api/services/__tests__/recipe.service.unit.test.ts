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
const ensureDefaultRecipeCategories = vi.fn();
const attachRecipeCategories = vi.fn(async (...args: unknown[]) => args[0]);
const syncRecipeCategoryAssignments = vi.fn();
const deleteRecipeCategoryAssignments = vi.fn();
const parseRecipeFromUrl = vi.fn();

vi.mock('../../db/models/index.ts', () => ({
  default: {
    transaction: vi.fn(async () => transaction),
    query: (...args: unknown[]) => sequelizeQuery(...args),
  },
}));

vi.mock('../entitlements.service.ts', () => ({
  assertCanCreateRecipe: (...args: unknown[]) => assertCanCreateRecipe(...args),
}));

vi.mock('../recipeCategories.service.ts', () => ({
  ensureDefaultRecipeCategories: (...args: unknown[]) => ensureDefaultRecipeCategories(...args),
  attachRecipeCategories: (...args: unknown[]) => attachRecipeCategories(...args),
  syncRecipeCategoryAssignments: (...args: unknown[]) => syncRecipeCategoryAssignments(...args),
  deleteRecipeCategoryAssignments: (...args: unknown[]) => deleteRecipeCategoryAssignments(...args),
}));

vi.mock('../recipe-import/parseRecipeFromUrl.ts', () => ({
  parseRecipeFromUrl: (...args: unknown[]) => parseRecipeFromUrl(...args),
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

import { importRecipeFromUrl } from '../recipe-import/import.service.ts';
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
    expect(syncRecipeCategoryAssignments).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 8, name: 'Soup' });
  });

  it('assigns category ids inside the create transaction', async () => {
    familyGroupFindByPk.mockResolvedValue({ dataValues: { id: 4 } });
    assertCanCreateRecipe.mockResolvedValue({});
    recipeCreate.mockResolvedValue({ dataValues: { id: 8 } });
    recipeFindByPk.mockResolvedValue({ id: 8, name: 'Soup' });

    await createRecipe({
      family_group_id: 4,
      created_by: 5,
      name: 'Soup',
      category_ids: [1, 1, 2],
    });

    expect(syncRecipeCategoryAssignments).toHaveBeenCalledWith(8, 4, 5, [1, 1, 2], transaction);
    expect(syncRecipeCategoryAssignments.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.commit.mock.invocationCallOrder[0]
    );
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
      family_group_id: 4,
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
    }, 5);

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

    await updateRecipe(8, { portions: 4 }, 5);

    expect(ingredientDestroy).not.toHaveBeenCalled();
    expect(ingredientBulkCreate).not.toHaveBeenCalled();
    expect(existing.update).toHaveBeenCalledWith(
      expect.objectContaining({ portions: 4, name: 'Old name' }),
      { transaction }
    );
  });

  it('rolls back when the recipe does not exist', async () => {
    recipeFindByPk.mockResolvedValue(null);

    await expect(updateRecipe(8, { name: 'Missing' }, 5)).rejects.toThrow('Recipe not found');
    expect(transaction.rollback).toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();
  });

  it('keeps category assignments when category_ids is omitted', async () => {
    recipeFindByPk
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ id: 8 });

    await updateRecipe(8, { name: 'New name' }, 5);

    expect(syncRecipeCategoryAssignments).not.toHaveBeenCalled();
  });

  it('clears category assignments when category_ids is empty', async () => {
    recipeFindByPk
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ id: 8 });

    await updateRecipe(8, { category_ids: [] }, 5);

    expect(syncRecipeCategoryAssignments).toHaveBeenCalledWith(8, 4, 5, [], transaction);
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
    expect(deleteRecipeCategoryAssignments).toHaveBeenCalledWith(8, transaction);
    expect(transaction.commit).toHaveBeenCalled();
  });
});

describe('importRecipeFromUrl', () => {
  it('creates the recipe without categories', async () => {
    parseRecipeFromUrl.mockResolvedValue({
      name: 'Imported soup',
      description: 'Warm',
      instructions: 'Simmer',
      portions: 2,
      ingredients: [],
    });
    familyGroupFindByPk.mockResolvedValue({ dataValues: { id: 4 } });
    assertCanCreateRecipe.mockResolvedValue({});
    recipeCreate.mockResolvedValue({ dataValues: { id: 8 } });
    recipeFindByPk.mockResolvedValue({ id: 8, name: 'Imported soup' });

    await importRecipeFromUrl({
      family_group_id: 4,
      created_by: 5,
      url: 'https://example.com/soup',
    });

    expect(recipeCreate.mock.calls[0][0]).not.toHaveProperty('category_ids');
    expect(syncRecipeCategoryAssignments).not.toHaveBeenCalled();
  });
});
