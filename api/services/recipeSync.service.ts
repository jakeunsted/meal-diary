import {
  normalizeRecipeSyncValue,
  recipeSyncValuesMatch,
  toRecipeSyncValue,
  type RecipeSyncStatus,
  type RecipeSyncValue,
} from '@meal-diary/shared';
import { Transaction } from 'sequelize';
import sequelize from '../db/models/index.ts';
import {
  Recipe,
  RecipeCategoryAssignment,
  RecipeIngredient,
} from '../db/models/associations.ts';
import { syncRecipeCategoryAssignments } from './recipeCategories.service.ts';
import { getRecipeById } from './recipe.service.ts';

export class RecipeSyncForbiddenError extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'RecipeSyncForbiddenError';
  }
}

export interface RecipeSyncServiceResult {
  status: RecipeSyncStatus;
  yours?: RecipeSyncValue;
  theirs?: RecipeSyncValue;
  baseline?: RecipeSyncValue;
  recipe?: Awaited<ReturnType<typeof getRecipeById>>;
}

export interface ApplyRecipeSyncInput {
  recipeId: number;
  userId: number;
  familyGroupId: number;
  baseline: RecipeSyncValue;
  recipe: RecipeSyncValue;
  /** Value the server must still match. Baseline on sync, the reviewed server value on resolve. */
  reference: RecipeSyncValue;
}

interface ModelRow {
  dataValues?: Record<string, unknown>;
}

const rowValue = (row: ModelRow): Record<string, unknown> => row.dataValues ?? (row as Record<string, unknown>);

const readServerValue = (
  recipe: ModelRow,
  ingredients: ModelRow[],
  assignments: ModelRow[]
): RecipeSyncValue => {
  const values = rowValue(recipe);
  return toRecipeSyncValue({
    name: typeof values.name === 'string' ? values.name : '',
    description: typeof values.description === 'string' ? values.description : null,
    instructions: typeof values.instructions === 'string' ? values.instructions : null,
    portions: typeof values.portions === 'number' ? values.portions : null,
    ingredients: ingredients.map((ingredient) => {
      const item = rowValue(ingredient);
      return {
        name: typeof item.name === 'string' ? item.name : '',
        quantity: typeof item.quantity === 'number' || typeof item.quantity === 'string'
          ? item.quantity
          : null,
        unit: typeof item.unit === 'string' ? item.unit : null,
      };
    }),
    category_ids: assignments.map((assignment) => {
      const item = rowValue(assignment);
      return typeof item.recipe_category_id === 'number' ? item.recipe_category_id : Number(item.recipe_category_id);
    }),
  });
};

export const applyRecipeSync = async (
  input: ApplyRecipeSyncInput
): Promise<RecipeSyncServiceResult> => {
  const yours = normalizeRecipeSyncValue(input.recipe);
  const baseline = normalizeRecipeSyncValue(input.baseline);
  const reference = normalizeRecipeSyncValue(input.reference);
  const transaction = await sequelize.transaction();

  try {
    const recipe = await Recipe.findByPk(input.recipeId, {
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (!recipe) {
      await transaction.rollback();
      return { status: 'not_found' };
    }

    const recipeRow = rowValue(recipe as unknown as ModelRow);
    const familyGroupId = recipeRow.family_group_id;
    if (familyGroupId !== input.familyGroupId) {
      await transaction.rollback();
      throw new RecipeSyncForbiddenError();
    }

    const ingredients = await RecipeIngredient.findAll({
      where: { recipe_id: input.recipeId },
      transaction,
    });
    const assignments = await RecipeCategoryAssignment.findAll({
      where: { recipe_id: input.recipeId },
      transaction,
    });
    const server = readServerValue(
      recipe as unknown as ModelRow,
      ingredients as unknown as ModelRow[],
      assignments as unknown as ModelRow[]
    );

    if (recipeSyncValuesMatch(yours, server)) {
      await transaction.rollback();
      return {
        status: 'already_saved',
        recipe: await getRecipeById(input.recipeId, input.userId),
      };
    }

    if (!recipeSyncValuesMatch(server, reference)) {
      await transaction.rollback();
      return {
        status: 'conflict',
        yours,
        theirs: server,
        baseline,
        recipe: await getRecipeById(input.recipeId, input.userId),
      };
    }

    await recipe.update({
      name: yours.name,
      description: yours.description,
      instructions: yours.instructions,
      portions: yours.portions,
    } as unknown as Parameters<typeof recipe.update>[0], { transaction });

    await RecipeIngredient.destroy({
      where: { recipe_id: input.recipeId },
      transaction,
    });
    if (yours.ingredients.length > 0) {
      await RecipeIngredient.bulkCreate(
        yours.ingredients.map((ingredient) => ({
          recipe_id: input.recipeId,
          name: ingredient.name,
          quantity: ingredient.quantity ?? undefined,
          unit: ingredient.unit ?? undefined,
        })),
        { transaction }
      );
    }

    await syncRecipeCategoryAssignments(
      input.recipeId,
      input.familyGroupId,
      input.userId,
      yours.category_ids,
      transaction
    );

    await transaction.commit();
    return {
      status: 'applied',
      recipe: await getRecipeById(input.recipeId, input.userId),
    };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {
      // The transaction was already finished.
    }
    throw error;
  }
};
