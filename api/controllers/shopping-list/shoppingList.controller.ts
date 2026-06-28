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
 * Retrieves the entire shopping list for a family group, including all items
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
 * Adds a new item to a shopping list
 * @param {Request} req - Express request object containing item details
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the newly created item
 */
export const addItem = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;
    const { name, parent_item_id } = req.body;

    const user = req.user as User;

    try {
      const item = await ShoppingListService.addItem(
        Number(family_group_id),
        name,
        Number(user.dataValues.id),
        parent_item_id !== undefined ? Number(parent_item_id) || null : undefined
      );

      // Track shopping list item added
      await trackEvent(user.dataValues.id.toString(), 'shopping_list_item_added', {
        family_group_id: Number(family_group_id),
        item_id: item.get('id'),
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
 * Adds multiple new items to a shopping list
 * @param {Request} req - Express request object containing item details
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the newly created items
 */
export const bulkAddItems = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;
    const { items } = req.body as { items?: { name: string; parent_item_id?: number | null }[] };

    if (!family_group_id || isNaN(Number(family_group_id))) {
      return res.status(400).json({ message: 'Valid family group ID is required' });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: 'Items array is required' });
    }

    const user = req.user as User;

    try {
      const createdItems = await ShoppingListService.bulkAddItems(
        Number(family_group_id),
        items,
        Number(user.dataValues.id)
      );

      // Track shopping list items added from bulk operation
      await trackEvent(user.dataValues.id.toString(), 'shopping_list_items_bulk_added', {
        family_group_id: Number(family_group_id),
        item_count: createdItems.length,
      });

      res.json(createdItems);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to add items';
      
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error adding items:', error);
    res.status(500).json({ message: 'Failed to add items' });
  }
};

/**
 * Reorders items in a shopping list by updating their parent and position.
 * @param {Request} req - Express request object containing reorder payload
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the updated items
 */
export const reorderItems = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;
    const { items } = req.body as { items?: { id: number; parent_item_id: number | null; position: number }[] };

    if (!family_group_id || isNaN(Number(family_group_id))) {
      return res.status(400).json({ message: 'Valid family group ID is required' });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: 'Items array is required' });
    }

    try {
      const actorUserId = (req.user as User)?.dataValues?.id;
      const updatedItems = await ShoppingListService.reorderItems(
        Number(family_group_id),
        items,
        actorUserId
      );

      return res.json(updatedItems);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to reorder items';

      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error reordering items:', error);
    res.status(500).json({ message: 'Failed to reorder items' });
  }
};

/**
 * Bulk update multiple shopping list items in a single request.
 * @param {Request} req - Express request object containing items to update
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the updated items
 */
export const bulkUpdateItems = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;
    const { items } = req.body as { items?: { id: number; name?: string; checked?: boolean; deleted?: boolean }[] };

    if (!family_group_id || isNaN(Number(family_group_id))) {
      return res.status(400).json({ message: 'Valid family group ID is required' });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: 'Items array is required' });
    }

    try {
      const actorUserId = (req.user as User)?.dataValues?.id;
      const updatedItems = await ShoppingListService.bulkUpdateItems(
        Number(family_group_id),
        items,
        actorUserId
      );

      const user = req.user as User;
      if (user) {
        await trackEvent(user.dataValues.id.toString(), 'shopping_list_items_bulk_updated', {
          family_group_id: Number(family_group_id),
          item_count: updatedItems.length,
        });
      }

      return res.json(updatedItems);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to update items';

      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }

      if (
        errorMessage.includes('must be') ||
        errorMessage.includes('At least one') ||
        errorMessage.includes('valid id')
      ) {
        return res.status(400).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error bulk updating items:', error);
    res.status(500).json({ message: 'Failed to update items' });
  }
};

/**
 * Bulk soft-delete multiple shopping list items in a single request.
 * @param {Request} req - Express request object containing item ids to delete
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the deleted items
 */
export const bulkDeleteItems = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;
    const { ids } = req.body as { ids?: number[] };

    if (!family_group_id || isNaN(Number(family_group_id))) {
      return res.status(400).json({ message: 'Valid family group ID is required' });
    }

    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: 'Ids array is required' });
    }

    try {
      const actorUserId = (req.user as User)?.dataValues?.id;
      const deletedItems = await ShoppingListService.bulkDeleteItems(
        Number(family_group_id),
        ids.map(Number),
        actorUserId
      );

      const user = req.user as User;
      if (user) {
        await trackEvent(user.dataValues.id.toString(), 'shopping_list_items_bulk_deleted', {
          family_group_id: Number(family_group_id),
          item_count: deletedItems.length,
        });
      }

      return res.json(deletedItems);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to delete items';

      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error bulk deleting items:', error);
    res.status(500).json({ message: 'Failed to delete items' });
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

    // Allow partial updates: at least one updatable field must be present
    if (name === undefined && checked === undefined) {
      return res.status(400).json({ message: 'At least one of name or checked is required' });
    }

    try {
      const actorUserId = (req.user as User)?.dataValues?.id;
      const item = await ShoppingListService.updateItem(
        Number(family_group_id),
        Number(item_id),
        { name, checked },
        actorUserId
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
      const actorUserId = (req.user as User)?.dataValues?.id;
      const item = await ShoppingListService.deleteItem(
        Number(family_group_id),
        Number(item_id),
        actorUserId
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
