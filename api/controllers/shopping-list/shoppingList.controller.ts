import type { Request, Response } from 'express';
import { User } from '../../db/models/associations.ts';
import { trackEvent } from '../../utils/posthog.ts';
import * as ShoppingListService from '../../services/shoppingList.service.ts';

/**
 * Creates a base shopping list for a family group
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the created shopping list
 */
export const createBaseShoppingList = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;
    const user = req.user as User;

    const shoppingList = await ShoppingListService.createBaseShoppingList(
      Number(family_group_id),
      Number(user.dataValues.id)
    );

    res.json(shoppingList);
  } catch (error) {
    console.error('Error creating shopping list:', error);
    res.status(500).json({ message: 'Failed to create shopping list' });
  }
};

/**
 * Retrieves the entire shopping list for a family group, including all categories and items
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the shopping list with all its categories and items
 */
export const getEntireShoppingList = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;
    const user = req.user as User;

    const shoppingList = await ShoppingListService.getEntireShoppingList(Number(family_group_id));

    if (!shoppingList) {
      return res.status(404).json({ message: 'Shopping list not found' });
    }

    if (user) {
      trackEvent(user.dataValues.id.toString(), 'shopping_list_loaded', {
        family_group_id: Number(family_group_id),
        shopping_list_id: shoppingList.get('id'),
      }).catch(err => {
        console.error('Failed to track PostHog event:', err);
      });
    }

    res.json(shoppingList);
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    res.status(500).json({ message: 'Failed to fetch shopping list' });
  }
};

/**
 * Adds a new category to a shopping list
 * @param {Request} req - Express request object containing category name and icon
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the newly created category
 */
export const addCategory = async (req: Request, res: Response) => {
  try {
    const { family_group_id, category_id } = req.params;

    if (!category_id) {
      return res.status(412).json({ message: 'Category ID is required' });
    }

    const user = req.user as User;

    try {
      const category = await ShoppingListService.addCategory(
        Number(family_group_id),
        Number(category_id),
        Number(user.dataValues.id)
      );

      // Track shopping list category added
      await trackEvent(user.dataValues.id.toString(), 'shopping_list_category_added', {
        family_group_id: Number(family_group_id),
        category_id: Number(category_id),
      });

      res.json(category);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to add category';
      
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ message: 'Failed to add category' });
  }
};

/**
 * Deletes a category from a family shopping list and soft deletes all its items
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the deleted category
 */
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { family_group_id, category_id } = req.params;

    try {
      const category = await ShoppingListService.deleteCategory(
        Number(family_group_id),
        Number(category_id)
      );

      res.json(category);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to delete category';
      
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Failed to delete category' });
  }
};

/**
 * Get all categories for a family group
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the categories
 */
export const getFamilyCategories = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;

    if (!family_group_id) {
      return res.status(412).json({ message: 'Family group ID is required' });
    }

    const categories = await ShoppingListService.getFamilyCategories(Number(family_group_id));

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};

/**
 * Adds a new item to a shopping list category
 * @param {Request} req - Express request object containing item details
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the newly created item
 */
export const addItem = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;
    const { name, shopping_list_categories } = req.body;

    const user = req.user as User;

    try {
      const item = await ShoppingListService.addItem(
        Number(family_group_id),
        Number(shopping_list_categories),
        name,
        Number(user.dataValues.id)
      );

      // Track shopping list item added
      await trackEvent(user.dataValues.id.toString(), 'shopping_list_item_added', {
        family_group_id: Number(family_group_id),
        item_id: item.get('id'),
        category_id: Number(shopping_list_categories),
      });

      res.json(item);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to add item';
      
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ message: 'Failed to add item' });
  }
};

/**
 * Updates an existing item in a shopping list category
 * @param {Request} req - Express request object containing updated item details
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the updated item
 */
export const updateItem = async (req: Request, res: Response) => {
  try {
    const { family_group_id, item_id } = req.params;
    const { name, checked } = req.body;

    // Validate required parameters
    if (!item_id || isNaN(Number(item_id))) {
      return res.status(400).json({ message: 'Valid item ID is required' });
    }

    if (!family_group_id || isNaN(Number(family_group_id))) {
      return res.status(400).json({ message: 'Valid family group ID is required' });
    }

    // Validate required fields
    if (name === undefined || checked === undefined) {
      return res.status(400).json({ message: 'Name and checked status are required' });
    }

    try {
      const item = await ShoppingListService.updateItem(
        Number(family_group_id),
        Number(item_id),
        name,
        checked
      );

      // Track shopping list item updated
      const user = req.user as User;
      if (user) {
        await trackEvent(user.dataValues.id.toString(), 'shopping_list_item_updated', {
          family_group_id: Number(family_group_id),
          item_id: Number(item_id),
        });
      }

      res.json(item);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to update item';
      
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }

      if (errorMessage.includes('must be')) {
        return res.status(400).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ message: 'Failed to update item' });
  }
};

/**
 * Soft deletes an item from a shopping list
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the deleted item
 */
export const deleteItem = async (req: Request, res: Response) => {
  try {
    const { family_group_id, item_id } = req.params;

    try {
      const item = await ShoppingListService.deleteItem(
        Number(family_group_id),
        Number(item_id)
      );

      // Track shopping list item deleted
      const user = req.user as User;
      if (user) {
        await trackEvent(user.dataValues.id.toString(), 'shopping_list_item_deleted', {
          family_group_id: Number(family_group_id),
          item_id: Number(item_id),
        });
      }

      res.json(item);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to delete item';
      
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Failed to delete item' });
  }
};
