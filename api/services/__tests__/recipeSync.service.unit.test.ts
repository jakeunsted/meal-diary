import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecipeSyncValue } from '@meal-diary/shared';

const recipeFindByPk = vi.fn();
const ingredientFindAll = vi.fn();
const ingredientDestroy = vi.fn();
const ingredientBulkCreate = vi.fn();
const assignmentFindAll = vi.fn();
const getRecipeById = vi.fn();
const syncRecipeCategoryAssignments = vi.fn();
const transaction = {
  commit: vi.fn(),
  rollback: vi.fn(),
};

vi.mock('../../db/models/index.ts', () => ({
  default: {
    transaction: vi.fn(async () => transaction),
  },
}));

vi.mock('../recipe.service.ts', () => ({
  getRecipeById: (...args: unknown[]) => getRecipeById(...args),
}));

vi.mock('../recipeCategories.service.ts', () => ({
  syncRecipeCategoryAssignments: (...args: unknown[]) => syncRecipeCategoryAssignments(...args),
}));

vi.mock('../../db/models/associations.ts', () => ({
  Recipe: {
    findByPk: (...args: unknown[]) => recipeFindByPk(...args),
  },
  RecipeIngredient: {
    findAll: (...args: unknown[]) => ingredientFindAll(...args),
    destroy: (...args: unknown[]) => ingredientDestroy(...args),
    bulkCreate: (...args: unknown[]) => ingredientBulkCreate(...args),
  },
  RecipeCategoryAssignment: {
    findAll: (...args: unknown[]) => assignmentFindAll(...args),
  },
}));

import { applyRecipeSync, RecipeSyncForbiddenError } from '../recipeSync.service.ts';

const soup: RecipeSyncValue = {
  name: 'Soup',
  description: null,
  instructions: 'Simmer',
  portions: 2,
  ingredients: [{ name: 'Onion', quantity: 1, unit: null }],
  category_ids: [2],
};

const stew: RecipeSyncValue = { ...soup, name: 'Stew' };

const lockedRecipe = () => ({
  dataValues: {
    id: 8,
    family_group_id: 4,
    name: 'Soup',
    description: null,
    instructions: 'Simmer',
    portions: 2,
  },
  update: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  transaction.commit.mockReset();
  transaction.rollback.mockReset();
  ingredientFindAll.mockResolvedValue([
    { dataValues: { name: 'Onion', quantity: 1, unit: null } },
  ]);
  assignmentFindAll.mockResolvedValue([
    { dataValues: { recipe_category_id: 2 } },
  ]);
  getRecipeById.mockResolvedValue({ id: 8, name: 'Soup' });
});

describe('applyRecipeSync', () => {
  it('applies an edit when the server still matches the baseline', async () => {
    const recipe = lockedRecipe();
    recipeFindByPk.mockResolvedValue(recipe);

    const result = await applyRecipeSync({
      recipeId: 8,
      userId: 3,
      familyGroupId: 4,
      baseline: soup,
      recipe: stew,
      reference: soup,
    });

    expect(result.status).toBe('applied');
    expect(recipe.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Stew' }), expect.any(Object));
    expect(ingredientDestroy).toHaveBeenCalled();
    expect(syncRecipeCategoryAssignments).toHaveBeenCalledWith(8, 4, 3, [2], transaction);
    expect(transaction.commit).toHaveBeenCalled();
  });

  it('reports already saved when the server matches the edit', async () => {
    recipeFindByPk.mockResolvedValue(lockedRecipe());

    const result = await applyRecipeSync({
      recipeId: 8,
      userId: 3,
      familyGroupId: 4,
      baseline: { ...soup, name: 'Old' },
      recipe: soup,
      reference: { ...soup, name: 'Old' },
    });

    expect(result.status).toBe('already_saved');
    expect(transaction.commit).not.toHaveBeenCalled();
  });

  it('returns a conflict when someone else changed the recipe', async () => {
    recipeFindByPk.mockResolvedValue(lockedRecipe());

    const result = await applyRecipeSync({
      recipeId: 8,
      userId: 3,
      familyGroupId: 4,
      baseline: { ...soup, name: 'Old' },
      recipe: stew,
      reference: { ...soup, name: 'Old' },
    });

    expect(result).toMatchObject({
      status: 'conflict',
      yours: expect.objectContaining({ name: 'Stew' }),
      theirs: expect.objectContaining({ name: 'Soup' }),
      baseline: expect.objectContaining({ name: 'Old' }),
    });
    expect(transaction.commit).not.toHaveBeenCalled();
  });

  it('applies keep-mine only while the server still matches the reviewed value', async () => {
    recipeFindByPk.mockResolvedValue(lockedRecipe());

    const applied = await applyRecipeSync({
      recipeId: 8,
      userId: 3,
      familyGroupId: 4,
      baseline: { ...soup, name: 'Old' },
      recipe: stew,
      reference: soup,
    });
    expect(applied.status).toBe('applied');

    const moved = await applyRecipeSync({
      recipeId: 8,
      userId: 3,
      familyGroupId: 4,
      baseline: { ...soup, name: 'Old' },
      recipe: stew,
      reference: { ...soup, name: 'Newer' },
    });
    expect(moved.status).toBe('conflict');
  });

  it('returns not found and rejects a recipe from another family', async () => {
    recipeFindByPk.mockResolvedValueOnce(null);
    await expect(applyRecipeSync({
      recipeId: 8,
      userId: 3,
      familyGroupId: 4,
      baseline: soup,
      recipe: stew,
      reference: soup,
    })).resolves.toEqual({ status: 'not_found' });

    recipeFindByPk.mockResolvedValueOnce({
      ...lockedRecipe(),
      dataValues: { ...lockedRecipe().dataValues, family_group_id: 9 },
    });
    await expect(applyRecipeSync({
      recipeId: 8,
      userId: 3,
      familyGroupId: 4,
      baseline: soup,
      recipe: stew,
      reference: soup,
    })).rejects.toBeInstanceOf(RecipeSyncForbiddenError);
  });
});
