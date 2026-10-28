import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from 'sequelize';
import { DEFAULT_RECIPE_CATEGORIES } from '@meal-diary/shared';
import {
  FamilyGroup,
  Recipe,
  RecipeCategory,
  RecipeCategoryAssignment,
} from '../../db/models/associations.ts';
import type RecipeCategoryModel from '../../db/models/RecipeCategory.model.ts';
import sequelize from '../../db/models/index.ts';
import { EntitlementRequiredError } from '../entitlements.service.ts';
import {
  createRecipeCategory,
  deleteRecipeCategory,
  ensureDefaultRecipeCategories,
  listRecipeCategories,
  loadRecipeCategories,
  renameRecipeCategory,
  syncRecipeCategoryAssignments,
} from '../recipeCategories.service.ts';

const assertFeature = vi.fn();
const resolveEntitlements = vi.fn();

vi.mock('../entitlements.service.ts', async () => {
  const actual = await vi.importActual<typeof import('../entitlements.service.ts')>(
    '../entitlements.service.ts'
  );
  return {
    ...actual,
    assertFeature: (...args: unknown[]) => assertFeature(...args),
    resolveEntitlements: (...args: unknown[]) => resolveEntitlements(...args),
  };
});

let customEnabled = false;
const transaction = {} as Transaction;

const fakeCategory = (values: Record<string, unknown>) =>
  ({
    dataValues: values,
    update: vi.fn(async function (
      this: { dataValues: Record<string, unknown> },
      patch: Record<string, unknown>
    ) {
      Object.assign(this.dataValues, patch);
    }),
  }) as unknown as RecipeCategoryModel;

const starter = (
  key: 'breakfast' | 'lunch' | 'dinner' | 'dessert',
  name: string,
  id: number
) =>
  fakeCategory({
    id,
    family_group_id: 4,
    name,
    is_default: true,
    default_key: key,
  });

const slowCooker = fakeCategory({
  id: 9,
  family_group_id: 4,
  name: 'Slow cooker',
  is_default: false,
  default_key: null,
});

const starters = [
  starter('breakfast', 'Breakfast', 1),
  starter('lunch', 'Lunch', 2),
  starter('dinner', 'Dinner', 3),
  starter('dessert', 'Dessert', 4),
];

beforeEach(() => {
  vi.restoreAllMocks();
  customEnabled = false;
  resolveEntitlements.mockReset();
  assertFeature.mockReset();
  resolveEntitlements.mockImplementation(async () => ({
    plan: customEnabled ? 'premium' : 'free',
    features: { custom_recipe_categories: customEnabled },
  }));
  assertFeature.mockImplementation(async () => {
    if (!customEnabled) {
      throw new EntitlementRequiredError('custom_recipe_categories', 'free');
    }
    return {};
  });
});

describe('ensureDefaultRecipeCategories', () => {
  it('inserts the four starters once and does nothing on the next call', async () => {
    const created = starters;
    vi.spyOn(RecipeCategory, 'findAll')
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce(created as never);
    const bulkCreate = vi.spyOn(RecipeCategory, 'bulkCreate').mockResolvedValue(created as never);

    await ensureDefaultRecipeCategories(4);
    await ensureDefaultRecipeCategories(4);

    expect(bulkCreate).toHaveBeenCalledTimes(1);
    expect(bulkCreate.mock.calls[0][0]).toEqual(
      DEFAULT_RECIPE_CATEGORIES.map((category) => ({
        family_group_id: 4,
        name: category.name,
        is_default: true,
        default_key: category.key,
      }))
    );
  });

  it('inserts only a missing starter key', async () => {
    vi.spyOn(RecipeCategory, 'findAll').mockResolvedValue([
      starters[0],
      starters[1],
      starters[2],
    ] as never);
    const bulkCreate = vi.spyOn(RecipeCategory, 'bulkCreate').mockResolvedValue([] as never);

    await ensureDefaultRecipeCategories(4);

    expect(bulkCreate).toHaveBeenCalledWith(
      [
        {
          family_group_id: 4,
          name: 'Dessert',
          is_default: true,
          default_key: 'dessert',
        },
      ],
      expect.objectContaining({ ignoreDuplicates: true })
    );
  });
});

describe('createRecipeCategory names', () => {
  it('rejects case-insensitive duplicates of a starter and a custom name', async () => {
    customEnabled = true;
    vi.spyOn(sequelize, 'transaction').mockImplementation((async (callback: (active: Transaction) => Promise<unknown>) =>
      callback(transaction)
    ) as never);
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue({ dataValues: { id: 4 } } as never);
    vi.spyOn(RecipeCategory, 'findAll').mockResolvedValue([...starters, slowCooker] as never);
    const create = vi.spyOn(RecipeCategory, 'create');

    await expect(createRecipeCategory(4, 5, ' breakfast ')).rejects.toMatchObject({
      code: 'duplicate',
    });
    await expect(createRecipeCategory(4, 5, 'SLOW COOKER')).rejects.toMatchObject({
      code: 'duplicate',
    });

    expect(create).not.toHaveBeenCalled();
    expect(FamilyGroup.findByPk).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ lock: 'UPDATE' })
    );
  });
});

describe('starter lock', () => {
  it('rejects renaming a starter before the entitlement check', async () => {
    vi.spyOn(RecipeCategory, 'findOne').mockResolvedValue(starters[0] as never);

    await expect(renameRecipeCategory(4, 5, 1, 'Brunch')).rejects.toMatchObject({
      code: 'default_category_locked',
    });
    expect(assertFeature).not.toHaveBeenCalled();
  });

  it('rejects deleting a starter before the entitlement check', async () => {
    vi.spyOn(RecipeCategory, 'findOne').mockResolvedValue(starters[2] as never);
    const destroyCategory = vi.spyOn(RecipeCategory, 'destroy');

    await expect(deleteRecipeCategory(4, 5, 3)).rejects.toMatchObject({
      code: 'default_category_locked',
    });
    expect(assertFeature).not.toHaveBeenCalled();
    expect(destroyCategory).not.toHaveBeenCalled();
  });
});

describe('deleteRecipeCategory', () => {
  it('deletes a custom category and its joins and keeps the recipe', async () => {
    customEnabled = true;
    vi.spyOn(RecipeCategory, 'findOne').mockResolvedValue(slowCooker as never);
    vi.spyOn(sequelize, 'transaction').mockImplementation((async (callback: (active: Transaction) => Promise<unknown>) =>
      callback(transaction)
    ) as never);
    const destroyAssignments = vi
      .spyOn(RecipeCategoryAssignment, 'destroy')
      .mockResolvedValue(1 as never);
    const destroyCategory = vi.spyOn(RecipeCategory, 'destroy').mockResolvedValue(1 as never);
    const destroyRecipe = vi.spyOn(Recipe, 'destroy').mockResolvedValue(0 as never);

    await deleteRecipeCategory(4, 5, 9);

    expect(destroyAssignments).toHaveBeenCalledWith({
      where: { recipe_category_id: 9 },
      transaction,
    });
    expect(destroyCategory).toHaveBeenCalledWith({
      where: { id: 9, family_group_id: 4, is_default: false },
      transaction,
    });
    expect(destroyRecipe).not.toHaveBeenCalled();
  });
});

describe('listRecipeCategories', () => {
  it('omits custom rows when the feature is off and marks the starters assignable', async () => {
    vi.spyOn(RecipeCategory, 'findAll').mockImplementation((async (options?: { where?: { is_default?: boolean } }) => {
      const rows = [...starters, slowCooker];
      if (options?.where?.is_default === true) {
        return rows.filter((row) => row.dataValues.is_default);
      }
      return rows;
    }) as never);

    const categories = await listRecipeCategories(4, 5);

    expect(categories.map((category) => category.name)).toEqual([
      'Breakfast',
      'Lunch',
      'Dinner',
      'Dessert',
    ]);
    expect(categories.map((category) => category.default_key)).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'dessert',
    ]);
    expect(categories.every((category) => category.assignable)).toBe(true);
  });
});

describe('loadRecipeCategories', () => {
  it('keeps a hidden custom assignment on the recipe with assignable false', async () => {
    vi.spyOn(RecipeCategoryAssignment, 'findAll').mockResolvedValue([
      { dataValues: { recipe_id: 8, recipe_category_id: 3 } },
      { dataValues: { recipe_id: 8, recipe_category_id: 9 } },
    ] as never);
    vi.spyOn(RecipeCategory, 'findAll').mockResolvedValue([
      slowCooker,
      starters[2],
    ] as never);

    const loaded = await loadRecipeCategories([8], 4, 5);

    expect(loaded.get(8)).toEqual([
      {
        id: 3,
        name: 'Dinner',
        is_default: true,
        default_key: 'dinner',
        assignable: true,
      },
      {
        id: 9,
        name: 'Slow cooker',
        is_default: false,
        default_key: null,
        assignable: false,
      },
    ]);
  });
});

describe('syncRecipeCategoryAssignments', () => {
  const assignment = (recipeCategoryId: number) =>
    ({ dataValues: { recipe_id: 8, recipe_category_id: recipeCategoryId } });

  it('removes an existing custom assignment while the feature is off', async () => {
    vi.spyOn(RecipeCategoryAssignment, 'findAll').mockResolvedValue([
      assignment(1),
      assignment(9),
    ] as never);
    vi.spyOn(RecipeCategory, 'findAll').mockResolvedValue([starters[0]] as never);
    const destroy = vi.spyOn(RecipeCategoryAssignment, 'destroy').mockResolvedValue(1 as never);
    const bulkCreate = vi.spyOn(RecipeCategoryAssignment, 'bulkCreate').mockResolvedValue([] as never);

    await syncRecipeCategoryAssignments(8, 4, 5, [1], transaction);

    expect(assertFeature).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledWith({ where: { recipe_id: 8 }, transaction });
    expect(bulkCreate).toHaveBeenCalledWith(
      [{ recipe_id: 8, recipe_category_id: 1 }],
      { transaction }
    );
  });

  it('rejects a lapsed update that adds a custom category', async () => {
    vi.spyOn(RecipeCategoryAssignment, 'findAll').mockResolvedValue([assignment(1)] as never);
    vi.spyOn(RecipeCategory, 'findAll').mockResolvedValue([starters[0], slowCooker] as never);
    const destroy = vi.spyOn(RecipeCategoryAssignment, 'destroy');

    await expect(
      syncRecipeCategoryAssignments(8, 4, 5, [1, 9], transaction)
    ).rejects.toMatchObject({
      code: 'ENTITLEMENT_REQUIRED',
      feature: 'custom_recipe_categories',
      plan: 'free',
    });
    expect(destroy).not.toHaveBeenCalled();
  });

  it('rejects creating a recipe assignment to a custom category while the feature is off', async () => {
    vi.spyOn(RecipeCategoryAssignment, 'findAll').mockResolvedValue([] as never);
    vi.spyOn(RecipeCategory, 'findAll').mockResolvedValue([slowCooker] as never);
    const destroy = vi.spyOn(RecipeCategoryAssignment, 'destroy');

    await expect(
      syncRecipeCategoryAssignments(8, 4, 5, [9], transaction)
    ).rejects.toBeInstanceOf(EntitlementRequiredError);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('assigns starter ids without the feature and dedupes them', async () => {
    vi.spyOn(RecipeCategoryAssignment, 'findAll').mockResolvedValue([] as never);
    vi.spyOn(RecipeCategory, 'findAll').mockResolvedValue([starters[2], starters[0]] as never);
    vi.spyOn(RecipeCategoryAssignment, 'destroy').mockResolvedValue(0 as never);
    const bulkCreate = vi.spyOn(RecipeCategoryAssignment, 'bulkCreate').mockResolvedValue([] as never);

    await syncRecipeCategoryAssignments(8, 4, 5, [3, 1, 3], transaction);

    expect(assertFeature).not.toHaveBeenCalled();
    expect(bulkCreate).toHaveBeenCalledWith(
      [
        { recipe_id: 8, recipe_category_id: 3 },
        { recipe_id: 8, recipe_category_id: 1 },
      ],
      { transaction }
    );
  });

  it('keeps a custom category the recipe already has while the feature is off', async () => {
    vi.spyOn(RecipeCategoryAssignment, 'findAll').mockResolvedValue([assignment(9)] as never);
    vi.spyOn(RecipeCategory, 'findAll').mockResolvedValue([slowCooker] as never);
    vi.spyOn(RecipeCategoryAssignment, 'destroy').mockResolvedValue(1 as never);
    const bulkCreate = vi.spyOn(RecipeCategoryAssignment, 'bulkCreate').mockResolvedValue([] as never);

    await syncRecipeCategoryAssignments(8, 4, 5, [9], transaction);

    expect(assertFeature).not.toHaveBeenCalled();
    expect(bulkCreate).toHaveBeenCalledWith(
      [{ recipe_id: 8, recipe_category_id: 9 }],
      { transaction }
    );
  });
});
