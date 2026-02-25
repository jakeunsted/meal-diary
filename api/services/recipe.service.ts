import { Recipe, RecipeIngredient, DailyMeal } from '../db/models/associations.ts';
import { Op } from 'sequelize';
import sequelize from '../db/models/index.ts';

interface IngredientInput {
  id?: number;
  name: string;
  quantity?: number;
  unit?: string;
}

interface CreateRecipeInput {
  family_group_id: number;
  created_by: number;
  name: string;
  description?: string;
  instructions?: string;
  portions?: number;
  ingredients?: IngredientInput[];
}

interface UpdateRecipeInput {
  name?: string;
  description?: string;
  instructions?: string;
  portions?: number;
  ingredients?: IngredientInput[];
}

/**
 * Get all recipes for a family group
 */
export const getRecipesByFamilyGroup = async (
  familyGroupId: number,
  search?: string
): Promise<Recipe[]> => {
  const where: any = { family_group_id: familyGroupId };

  if (search) {
    where.name = { [Op.iLike]: `%${search}%` };
  }

  const recipes = await Recipe.findAll({
    where,
    include: [{
      model: RecipeIngredient,
      as: 'ingredients',
    }],
    order: [['name', 'ASC']],
  });

  return recipes;
};

/**
 * Get a single recipe by ID
 */
export const getRecipeById = async (recipeId: number): Promise<Recipe | null> => {
  const recipe = await Recipe.findByPk(recipeId, {
    include: [{
      model: RecipeIngredient,
      as: 'ingredients',
    }],
  });

  return recipe;
};

/**
 * Create a new recipe with ingredients
 */
export const createRecipe = async (input: CreateRecipeInput): Promise<Recipe> => {
  const transaction = await sequelize.transaction();

  try {
    const recipe = await Recipe.create({
      family_group_id: input.family_group_id,
      created_by: input.created_by,
      name: input.name,
      description: input.description,
      instructions: input.instructions,
      portions: input.portions,
    }, { transaction });

    if (input.ingredients && input.ingredients.length > 0) {
      await RecipeIngredient.bulkCreate(
        input.ingredients.map(ingredient => ({
          recipe_id: recipe.dataValues.id,
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        })),
        { transaction }
      );
    }

    await transaction.commit();

    // Re-fetch with ingredients
    const fullRecipe = await getRecipeById(recipe.dataValues.id);
    return fullRecipe!;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Update an existing recipe
 */
export const updateRecipe = async (
  recipeId: number,
  input: UpdateRecipeInput
): Promise<Recipe> => {
  const transaction = await sequelize.transaction();

  try {
    const recipe = await Recipe.findByPk(recipeId, { transaction });
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    await recipe.update({
      name: input.name ?? recipe.dataValues.name,
      description: input.description ?? recipe.dataValues.description,
      instructions: input.instructions ?? recipe.dataValues.instructions,
      portions: input.portions ?? recipe.dataValues.portions,
    }, { transaction });

    if (input.ingredients !== undefined) {
      // Remove existing ingredients and re-create
      await RecipeIngredient.destroy({
        where: { recipe_id: recipeId },
        transaction,
      });

      if (input.ingredients.length > 0) {
        await RecipeIngredient.bulkCreate(
          input.ingredients.map(ingredient => ({
            recipe_id: recipeId,
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          })),
          { transaction }
        );
      }
    }

    await transaction.commit();

    const fullRecipe = await getRecipeById(recipeId);
    return fullRecipe!;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Delete a recipe and clear references from daily meals
 */
export const deleteRecipe = async (recipeId: number): Promise<void> => {
  const transaction = await sequelize.transaction();

  try {
    // Clear recipe references from daily meals
    await DailyMeal.update(
      { breakfast: '' } as any,
      { where: { breakfast_recipe_id: recipeId }, transaction }
    );
    await DailyMeal.update(
      { lunch: '' } as any,
      { where: { lunch_recipe_id: recipeId }, transaction }
    );
    await DailyMeal.update(
      { dinner: '' } as any,
      { where: { dinner_recipe_id: recipeId }, transaction }
    );
    // Sequelize.literal used to set nullable FK columns to NULL
    const { literal } = await import('sequelize');
    await sequelize.query(
      `UPDATE daily_meals SET breakfast_recipe_id = NULL WHERE breakfast_recipe_id = $1`,
      { bind: [recipeId], transaction }
    );
    await sequelize.query(
      `UPDATE daily_meals SET lunch_recipe_id = NULL WHERE lunch_recipe_id = $1`,
      { bind: [recipeId], transaction }
    );
    await sequelize.query(
      `UPDATE daily_meals SET dinner_recipe_id = NULL WHERE dinner_recipe_id = $1`,
      { bind: [recipeId], transaction }
    );

    // Delete ingredients (cascade should handle this, but explicit is safer)
    await RecipeIngredient.destroy({
      where: { recipe_id: recipeId },
      transaction,
    });

    // Delete the recipe
    await Recipe.destroy({
      where: { id: recipeId },
      transaction,
    });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
