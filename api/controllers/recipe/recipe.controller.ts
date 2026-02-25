import type { Request, Response } from 'express';
import { User } from '../../db/models/associations.ts';
import * as recipeService from '../../services/recipe.service.ts';

/**
 * Get all recipes for a family group
 */
export const getRecipes = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;
    const { search } = req.query;

    if (!family_group_id) {
      return res.status(400).json({ message: 'Family group ID is required' });
    }

    const recipes = await recipeService.getRecipesByFamilyGroup(
      parseInt(family_group_id),
      search as string | undefined
    );

    return res.status(200).json(recipes);
  } catch (error) {
    console.error('Error getting recipes:', error);
    return res.status(500).json({ message: 'Failed to get recipes' });
  }
};

/**
 * Get a single recipe by ID
 */
export const getRecipeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Recipe ID is required' });
    }

    const recipe = await recipeService.getRecipeById(parseInt(id));

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    return res.status(200).json(recipe);
  } catch (error) {
    console.error('Error getting recipe:', error);
    return res.status(500).json({ message: 'Failed to get recipe' });
  }
};

/**
 * Create a new recipe
 */
export const createRecipe = async (req: Request, res: Response) => {
  try {
    const { family_group_id, name, description, instructions, portions, ingredients } = req.body;
    const user = req.user as User;

    if (!family_group_id || !name) {
      return res.status(400).json({ message: 'Family group ID and name are required' });
    }

    const recipe = await recipeService.createRecipe({
      family_group_id,
      created_by: user.dataValues.id,
      name,
      description,
      instructions,
      portions,
      ingredients,
    });

    return res.status(201).json(recipe);
  } catch (error) {
    console.error('Error creating recipe:', error);
    return res.status(500).json({ message: 'Failed to create recipe' });
  }
};

/**
 * Update an existing recipe
 */
export const updateRecipe = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, instructions, portions, ingredients } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Recipe ID is required' });
    }

    // Verify recipe exists
    const existingRecipe = await recipeService.getRecipeById(parseInt(id));
    if (!existingRecipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const recipe = await recipeService.updateRecipe(parseInt(id), {
      name,
      description,
      instructions,
      portions,
      ingredients,
    });

    return res.status(200).json(recipe);
  } catch (error) {
    console.error('Error updating recipe:', error);
    return res.status(500).json({ message: 'Failed to update recipe' });
  }
};

/**
 * Delete a recipe
 */
export const deleteRecipe = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Recipe ID is required' });
    }

    const existingRecipe = await recipeService.getRecipeById(parseInt(id));
    if (!existingRecipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    await recipeService.deleteRecipe(parseInt(id));

    return res.status(200).json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    return res.status(500).json({ message: 'Failed to delete recipe' });
  }
};
