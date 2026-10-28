import {
  DEFAULT_RECIPE_CATEGORIES,
  RECIPE_CATEGORY_STARTER_KEYS,
  getRecipeCategoryNameError,
  normalizeRecipeCategoryName,
  recipeCategoryNameError,
  type RecipeCategoryNameErrorCode,
  type RecipeCategoryStarterKey,
} from '@meal-diary/shared';
import { Op, Transaction } from 'sequelize';
import sequelize from '../db/models/index.ts';
import {
  FamilyGroup,
  RecipeCategory,
  RecipeCategoryAssignment,
} from '../db/models/associations.ts';
import type { RecipeCategoryAttributes } from '../db/models/RecipeCategory.model.ts';
import {
  assertFeature,
  resolveEntitlements,
} from './entitlements.service.ts';

const NAME_MESSAGES: Record<RecipeCategoryNameErrorCode, string> = {
  empty: 'Category name is required',
  too_long: 'Category name must be 32 characters or fewer',
  emoji: 'Category name cannot include emoji',
  control_chars: 'Category name cannot include control characters',
  duplicate: 'A category with this name already exists',
};

export class RecipeCategoryNameError extends Error {
  readonly code: RecipeCategoryNameErrorCode;

  constructor(code: RecipeCategoryNameErrorCode) {
    super(NAME_MESSAGES[code]);
    this.name = 'RecipeCategoryNameError';
    this.code = code;
  }
}

export class DefaultCategoryLockedError extends Error {
  readonly code = 'default_category_locked';

  constructor() {
    super('Starter categories cannot be renamed or deleted');
    this.name = 'DefaultCategoryLockedError';
  }
}

export class RecipeCategoryNotFoundError extends Error {
  constructor() {
    super('Category not found');
    this.name = 'RecipeCategoryNotFoundError';
  }
}

export class InvalidRecipeCategoryError extends Error {
  readonly code = 'invalid_category';

  constructor() {
    super('One or more categories are not in this family');
    this.name = 'InvalidRecipeCategoryError';
  }
}

export interface RecipeCategoryDto {
  id: number;
  family_group_id: number;
  name: string;
  is_default: boolean;
  default_key: RecipeCategoryStarterKey | null;
  assignable: boolean;
}

export interface RecipeCategoryOnRecipe {
  id: number;
  name: string;
  is_default: boolean;
  default_key: RecipeCategoryStarterKey | null;
  assignable: boolean;
}

interface RecipeCategoryCarrier {
  dataValues?: { id?: number };
  setDataValue?: (key: never, value: never) => void;
}

interface SortableCategory {
  name: string;
  is_default: boolean;
  default_key: string | null;
}

const starterRank = (category: SortableCategory): number => {
  if (!category.is_default || category.default_key == null) {
    return RECIPE_CATEGORY_STARTER_KEYS.length;
  }
  const index = RECIPE_CATEGORY_STARTER_KEYS.indexOf(
    category.default_key as RecipeCategoryStarterKey
  );
  return index === -1 ? RECIPE_CATEGORY_STARTER_KEYS.length : index;
};

export const sortRecipeCategories = <T>(categories: T[]): T[] =>
  [...categories].sort((left, right) => {
    const leftCategory = left as SortableCategory;
    const rightCategory = right as SortableCategory;
    const rank = starterRank(leftCategory) - starterRank(rightCategory);
    if (rank !== 0) {
      return rank;
    }
    return leftCategory.name.localeCompare(rightCategory.name, 'en', { sensitivity: 'base' });
  });

const categoryValues = (category: RecipeCategory): RecipeCategoryAttributes =>
  category.dataValues;

const toRecipeCategoryOnRecipe = (
  category: RecipeCategory,
  canUseCustom: boolean
): RecipeCategoryOnRecipe => {
  const values = categoryValues(category);
  return {
    id: values.id,
    name: values.name,
    is_default: values.is_default,
    default_key: values.default_key,
    assignable: values.is_default || canUseCustom,
  };
};

const toCategoryDto = (category: RecipeCategory): RecipeCategoryDto => ({
  ...toRecipeCategoryOnRecipe(category, true),
  family_group_id: categoryValues(category).family_group_id,
});

const parseCategoryName = (name: unknown): string => {
  if (typeof name !== 'string') {
    throw new RecipeCategoryNameError('empty');
  }
  const error = getRecipeCategoryNameError(name);
  if (error) {
    throw new RecipeCategoryNameError(error);
  }
  return normalizeRecipeCategoryName(name);
};

const lockFamilyGroup = async (
  familyGroupId: number,
  transaction: Transaction
): Promise<void> => {
  const familyGroup = await FamilyGroup.findByPk(familyGroupId, {
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });
  if (!familyGroup) {
    throw new Error('Family group not found');
  }
};

const assertCategoryNameAvailable = async (
  familyGroupId: number,
  name: string,
  excludeCategoryId: number | null,
  transaction: Transaction
): Promise<void> => {
  const categories = await RecipeCategory.findAll({
    where: { family_group_id: familyGroupId },
    transaction,
  });
  const names = categories
    .filter(
      (category) =>
        excludeCategoryId == null || category.dataValues.id !== excludeCategoryId
    )
    .map((category) => category.dataValues.name);
  if (recipeCategoryNameError(name, names) === 'duplicate') {
    throw new RecipeCategoryNameError('duplicate');
  }
};

const findFamilyCategory = async (
  familyGroupId: number,
  categoryId: number,
  transaction?: Transaction
): Promise<RecipeCategory | null> =>
  RecipeCategory.findOne({
    where: { id: categoryId, family_group_id: familyGroupId },
    transaction,
  });

export const ensureDefaultRecipeCategories = async (
  familyGroupId: number,
  transaction?: Transaction
): Promise<void> => {
  const existing = await RecipeCategory.findAll({
    where: { family_group_id: familyGroupId },
    transaction,
  });
  const present = new Set(
    existing
      .map((category) => category.dataValues.default_key)
      .filter((key): key is RecipeCategoryStarterKey => key != null)
  );
  const missing = DEFAULT_RECIPE_CATEGORIES.filter((starter) => !present.has(starter.key));
  if (missing.length === 0) {
    return;
  }

  await RecipeCategory.bulkCreate(
    missing.map((starter) => ({
      family_group_id: familyGroupId,
      name: starter.name,
      is_default: true,
      default_key: starter.key,
    })),
    { transaction, ignoreDuplicates: true }
  );
};

const canUseCustomRecipeCategories = async (
  familyGroupId: number,
  requestingUserId: number,
  transaction?: Transaction
): Promise<boolean> => {
  const entitlements = await resolveEntitlements(
    familyGroupId,
    requestingUserId,
    transaction
  );
  return entitlements.features.custom_recipe_categories;
};

export const listRecipeCategories = async (
  familyGroupId: number,
  requestingUserId: number
): Promise<RecipeCategoryDto[]> => {
  await ensureDefaultRecipeCategories(familyGroupId);
  const canUseCustom = await canUseCustomRecipeCategories(familyGroupId, requestingUserId);
  const categories = await RecipeCategory.findAll({
    where: {
      family_group_id: familyGroupId,
      ...(canUseCustom ? {} : { is_default: true }),
    },
  });
  return sortRecipeCategories(categories.map((category) => toCategoryDto(category)));
};

export const createRecipeCategory = async (
  familyGroupId: number,
  requestingUserId: number,
  name: unknown
): Promise<RecipeCategoryDto> => {
  const normalized = parseCategoryName(name);
  await assertFeature(familyGroupId, requestingUserId, 'custom_recipe_categories');

  return sequelize.transaction(async (transaction) => {
    await lockFamilyGroup(familyGroupId, transaction);
    await ensureDefaultRecipeCategories(familyGroupId, transaction);
    await assertCategoryNameAvailable(familyGroupId, normalized, null, transaction);
    const created = await RecipeCategory.create(
      {
        family_group_id: familyGroupId,
        name: normalized,
        is_default: false,
        default_key: null,
      },
      { transaction }
    );
    return toCategoryDto(created);
  });
};

export const renameRecipeCategory = async (
  familyGroupId: number,
  requestingUserId: number,
  categoryId: number,
  name: unknown
): Promise<RecipeCategoryDto> => {
  const existing = await findFamilyCategory(familyGroupId, categoryId);
  if (!existing) {
    throw new RecipeCategoryNotFoundError();
  }
  if (existing.dataValues.is_default) {
    throw new DefaultCategoryLockedError();
  }

  await assertFeature(familyGroupId, requestingUserId, 'custom_recipe_categories');
  const normalized = parseCategoryName(name);

  return sequelize.transaction(async (transaction) => {
    await lockFamilyGroup(familyGroupId, transaction);
    await ensureDefaultRecipeCategories(familyGroupId, transaction);
    const current = await findFamilyCategory(familyGroupId, categoryId, transaction);
    if (!current) {
      throw new RecipeCategoryNotFoundError();
    }
    if (current.dataValues.is_default) {
      throw new DefaultCategoryLockedError();
    }
    await assertCategoryNameAvailable(familyGroupId, normalized, categoryId, transaction);
    await current.update({ name: normalized }, { transaction });
    return toCategoryDto(current);
  });
};

export const deleteRecipeCategory = async (
  familyGroupId: number,
  requestingUserId: number,
  categoryId: number
): Promise<void> => {
  const existing = await findFamilyCategory(familyGroupId, categoryId);
  if (!existing) {
    throw new RecipeCategoryNotFoundError();
  }
  if (existing.dataValues.is_default) {
    throw new DefaultCategoryLockedError();
  }

  await assertFeature(familyGroupId, requestingUserId, 'custom_recipe_categories');

  await sequelize.transaction(async (transaction) => {
    const current = await findFamilyCategory(familyGroupId, categoryId, transaction);
    if (!current) {
      throw new RecipeCategoryNotFoundError();
    }
    if (current.dataValues.is_default) {
      throw new DefaultCategoryLockedError();
    }
    await RecipeCategoryAssignment.destroy({
      where: { recipe_category_id: categoryId },
      transaction,
    });
    await RecipeCategory.destroy({
      where: {
        id: categoryId,
        family_group_id: familyGroupId,
        is_default: false,
      },
      transaction,
    });
  });
};

const normalizeCategoryIds = (categoryIds: number[]): number[] => {
  if (!Array.isArray(categoryIds)) {
    throw new InvalidRecipeCategoryError();
  }
  const unique: number[] = [];
  const seen = new Set<number>();
  for (const id of categoryIds) {
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
      throw new InvalidRecipeCategoryError();
    }
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  return unique;
};

export const syncRecipeCategoryAssignments = async (
  recipeId: number,
  familyGroupId: number,
  requestingUserId: number,
  categoryIds: number[],
  transaction?: Transaction
): Promise<void> => {
  const uniqueIds = normalizeCategoryIds(categoryIds);

  const apply = async (activeTransaction: Transaction): Promise<void> => {
    if (uniqueIds.length === 0) {
      await RecipeCategoryAssignment.destroy({
        where: { recipe_id: recipeId },
        transaction: activeTransaction,
      });
      return;
    }

    const categories = await RecipeCategory.findAll({
      where: {
        id: { [Op.in]: uniqueIds },
        family_group_id: familyGroupId,
      },
      transaction: activeTransaction,
    });
    if (categories.length !== uniqueIds.length) {
      throw new InvalidRecipeCategoryError();
    }

    const existing = await RecipeCategoryAssignment.findAll({
      where: { recipe_id: recipeId },
      transaction: activeTransaction,
    });
    const existingIds = new Set(
      existing.map((assignment) => assignment.dataValues.recipe_category_id)
    );
    const addsCustomCategory = categories.some(
      (category) =>
        !category.dataValues.is_default && !existingIds.has(category.dataValues.id)
    );
    if (addsCustomCategory) {
      await assertFeature(familyGroupId, requestingUserId, 'custom_recipe_categories');
    }

    await RecipeCategoryAssignment.destroy({
      where: { recipe_id: recipeId },
      transaction: activeTransaction,
    });
    await RecipeCategoryAssignment.bulkCreate(
      uniqueIds.map((recipeCategoryId) => ({
        recipe_id: recipeId,
        recipe_category_id: recipeCategoryId,
      })),
      { transaction: activeTransaction }
    );
  };

  if (transaction) {
    await apply(transaction);
    return;
  }
  await sequelize.transaction(apply);
};

export const deleteRecipeCategoryAssignments = async (
  recipeId: number,
  transaction?: Transaction
): Promise<void> => {
  await RecipeCategoryAssignment.destroy({
    where: { recipe_id: recipeId },
    transaction,
  });
};

export const loadRecipeCategories = async (
  recipeIds: number[],
  familyGroupId: number,
  requestingUserId: number,
  transaction?: Transaction
): Promise<Map<number, RecipeCategoryOnRecipe[]>> => {
  const byRecipe = new Map<number, RecipeCategoryOnRecipe[]>();
  for (const recipeId of recipeIds) {
    byRecipe.set(recipeId, []);
  }
  if (recipeIds.length === 0) {
    return byRecipe;
  }

  const canUseCustom = await canUseCustomRecipeCategories(
    familyGroupId,
    requestingUserId,
    transaction
  );
  const assignments = await RecipeCategoryAssignment.findAll({
    where: { recipe_id: { [Op.in]: recipeIds } },
    transaction,
  });
  if (assignments.length === 0) {
    return byRecipe;
  }

  const categoryIds = [
    ...new Set(assignments.map((assignment) => assignment.dataValues.recipe_category_id)),
  ];
  const categories = await RecipeCategory.findAll({
    where: {
      id: { [Op.in]: categoryIds },
      family_group_id: familyGroupId,
    },
    transaction,
  });
  const categoriesById = new Map(
    categories.map((category) => [category.dataValues.id, category])
  );
  const grouped = new Map<number, RecipeCategory[]>();
  for (const assignment of assignments) {
    const category = categoriesById.get(assignment.dataValues.recipe_category_id);
    if (!category) {
      continue;
    }
    const list = grouped.get(assignment.dataValues.recipe_id) ?? [];
    list.push(category);
    grouped.set(assignment.dataValues.recipe_id, list);
  }

  for (const [recipeId, recipeCategories] of grouped) {
    byRecipe.set(
      recipeId,
      sortRecipeCategories(
        recipeCategories.map((category) => toRecipeCategoryOnRecipe(category, canUseCustom))
      )
    );
  }
  return byRecipe;
};

export const attachRecipeCategories = async (
  recipes: RecipeCategoryCarrier[],
  familyGroupId: number,
  requestingUserId: number,
  transaction?: Transaction
): Promise<void> => {
  const recipeIds = recipes
    .map((recipe) => recipe.dataValues?.id)
    .filter((id): id is number => typeof id === 'number');
  const byRecipe = await loadRecipeCategories(
    recipeIds,
    familyGroupId,
    requestingUserId,
    transaction
  );
  for (const recipe of recipes) {
    const recipeId = recipe.dataValues?.id;
    const categories =
      typeof recipeId === 'number' ? (byRecipe.get(recipeId) ?? []) : [];
    if (typeof recipe.setDataValue === 'function') {
      (recipe.setDataValue as (key: string, value: unknown) => void)('categories', categories);
    }
  }
};
