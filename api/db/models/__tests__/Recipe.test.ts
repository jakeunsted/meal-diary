import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Recipe, User } from '../../db.ts';
import { ValidationError } from 'sequelize';
import type { UserAttributes } from '../User.model.ts';

describe('Recipe Model', () => {
  let testUser: User;

  beforeAll(async () => {
    // Create a test user for recipe creation
    testUser = await User.create({
      username: 'vitest_recipe_test_user',
      email: 'vitest_recipe_test@example.com',
      password_hash: 'hashedpassword123'
    });
  });

  afterAll(async () => {
    // Clean up test user
    await testUser.destroy();
  });

  it('should create a new recipe successfully', async () => {
    const recipe = await Recipe.create({
      name: 'Test Recipe',
      method: 'Test method steps',
      created_by: (testUser as any).id
    });

    const recipeJson = recipe.toJSON();
    expect(recipeJson).toBeDefined();
    expect(recipeJson.id).toBeDefined();
    expect(recipeJson.name).toBe('Test Recipe');
    expect(recipeJson.method).toBe('Test method steps');
    expect(recipeJson.created_by).toBe((testUser as any).id);
  }, 15000);

  it('should require a name', async () => {
    const incompleteData = {
      method: 'Test method steps',
      created_by: (testUser as any).id
    };

    await expect(Recipe.create(incompleteData as any)).rejects.toThrow(ValidationError);
  }, 15000);

  it('should require a creator', async () => {
    const incompleteData = {
      name: 'Test Recipe',
      method: 'Test method steps'
    };

    await expect(Recipe.create(incompleteData as any)).rejects.toThrow(ValidationError);
  }, 15000);

  it('should be able to delete a recipe', async () => {
    const recipe = await Recipe.create({
      name: 'Test Recipe Delete',
      method: 'Test method steps',
      created_by: (testUser as any).id
    });

    const recipeJson = recipe.toJSON();
    expect(recipeJson).toBeDefined();
    expect(recipeJson.id).toBeDefined();

    await recipe.destroy();
    const deletedRecipe = await Recipe.findByPk(recipeJson.id);
    expect(deletedRecipe).toBeNull();
  }, 15000);
});
