import { describe, it, expect } from 'vitest';
import { Ingredient } from '../../db.ts';
import { ValidationError } from 'sequelize';

describe('Ingredient Model', () => {
  it('should create a new ingredient successfully', async () => {
    const ingredient = await Ingredient.create({
      name: 'Test Ingredient'
    });

    const ingredientJson = ingredient.toJSON();
    expect(ingredientJson).toBeDefined();
    expect(ingredientJson.id).toBeDefined();
    expect(ingredientJson.name).toBe('Test Ingredient');
  }, 15000);

  it('should require a name', async () => {
    const incompleteData = {};

    await expect(Ingredient.create(incompleteData as any)).rejects.toThrow(ValidationError);
  }, 15000);

  it('should require a unique name', async () => {
    // Create an ingredient first
    await Ingredient.create({
      name: 'vitest_test_unique_ingredient'
    });
    
    try {
      // Try to create another ingredient with the same name
      await Ingredient.create({
        name: 'vitest_test_unique_ingredient'
      });
      
      expect.fail('Should have thrown a validation error');
    } catch (error) {
      expect((error as ValidationError).message).toContain('Validation error');
    }
  }, 15000);

  it('should be able to delete an ingredient', async () => {
    const ingredient = await Ingredient.create({
      name: 'Test Ingredient Delete'
    });

    const ingredientJson = ingredient.toJSON();
    expect(ingredientJson).toBeDefined();
    expect(ingredientJson.id).toBeDefined();

    await ingredient.destroy();
    const deletedIngredient = await Ingredient.findByPk(ingredientJson.id);
    expect(deletedIngredient).toBeNull();
  }, 15000);
});
