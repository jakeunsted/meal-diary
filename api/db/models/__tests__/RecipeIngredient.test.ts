import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RecipeIngredient, Recipe, Ingredient, User } from '../../db.ts';
import { ValidationError } from 'sequelize';

describe('RecipeIngredient Model', () => {
  let testUser: User;
  let testRecipe: Recipe;
  let testIngredient: Ingredient;

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      username: 'vitest_recipe_ingredient_test_user',
      email: 'vitest_recipe_ingredient_test@example.com',
      password_hash: 'hashedpassword123'
    });

    // Create test recipe
    testRecipe = await Recipe.create({
      name: 'Test Recipe for Ingredients',
      method: 'Test method steps',
      created_by: (testUser as any).id
    });

    // Create test ingredient
    testIngredient = await Ingredient.create({
      name: 'Test Ingredient for Recipe'
    });
  });

  afterEach(async () => {
    // Clean up test data
    await RecipeIngredient.destroy({ where: {} });
    await testRecipe.destroy();
    await testIngredient.destroy();
    await testUser.destroy();
  });

  it('should create a new recipe ingredient successfully', async () => {
    const recipeIngredient = await RecipeIngredient.create({
      recipe_id: (testRecipe as any).id,
      ingredient_id: (testIngredient as any).id,
      quantity: 100.5,
      unit: 'g'
    });

    const recipeIngredientJson = recipeIngredient.toJSON();
    expect(recipeIngredientJson).toBeDefined();
    expect(recipeIngredientJson.id).toBeDefined();
    expect(recipeIngredientJson.recipe_id).toBe((testRecipe as any).id);
    expect(recipeIngredientJson.ingredient_id).toBe((testIngredient as any).id);
    expect(Number(recipeIngredientJson.quantity)).toBe(100.5);
    expect(recipeIngredientJson.unit).toBe('g');
  }, 15000);

  it('should require all fields', async () => {
    const incompleteData = {
      recipe_id: (testRecipe as any).id,
      ingredient_id: (testIngredient as any).id
    };

    await expect(RecipeIngredient.create(incompleteData as any)).rejects.toThrow(ValidationError);
  }, 15000);

  it('should prevent duplicate ingredients in the same recipe', async () => {
    // Create first recipe ingredient
    await RecipeIngredient.create({
      recipe_id: (testRecipe as any).id,
      ingredient_id: (testIngredient as any).id,
      quantity: 100,
      unit: 'g'
    });
    
    try {
      // Try to create another recipe ingredient with the same recipe and ingredient
      await RecipeIngredient.create({
        recipe_id: (testRecipe as any).id,
        ingredient_id: (testIngredient as any).id,
        quantity: 200,
        unit: 'g'
      });
      
      expect.fail('Should have thrown a validation error');
    } catch (error) {
      expect((error as ValidationError).message).toContain('Validation error');
    }
  }, 15000);

  it('should be able to delete a recipe ingredient', async () => {
    const recipeIngredient = await RecipeIngredient.create({
      recipe_id: (testRecipe as any).id,
      ingredient_id: (testIngredient as any).id,
      quantity: 150,
      unit: 'ml'
    });

    const recipeIngredientJson = recipeIngredient.toJSON();
    expect(recipeIngredientJson).toBeDefined();
    expect(recipeIngredientJson.id).toBeDefined();

    await recipeIngredient.destroy();
    const deletedRecipeIngredient = await RecipeIngredient.findByPk(recipeIngredientJson.id);
    expect(deletedRecipeIngredient).toBeNull();
  }, 15000);
});
