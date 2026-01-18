import type { Request, Response } from 'express';
import { trackEvent } from '../../utils/posthog.ts';
import { User } from '../../db/models/associations.ts';
import * as ItemCategoryService from '../../services/itemCategories.service.ts';

export const getAllItemCategories = async (req: Request, res: Response) => {
  try {
    const categories = await ItemCategoryService.getAllItemCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching item categories:', error);
    res.status(500).json({ message: 'Error fetching item categories' });
  }
};

export const getItemCategoryById = async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);

    try {
      const category = await ItemCategoryService.getItemCategoryById(categoryId);
      res.json(category);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Item category not found';
      
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error fetching item category:', error);
    res.status(500).json({ message: 'Error fetching item category' });
  }
};

export const createItemCategory = async (req: Request, res: Response) => {
  try {
    const { name, icon } = req.body;

    try {
      const category = await ItemCategoryService.createItemCategory({ name, icon });

      // Track item category created
      const user = req.user as User;
      if (user) {
        await trackEvent(user.dataValues.id.toString(), 'item_category_created', {
          category_id: category.get('id'),
          category_name: name,
        });
      }

      res.status(201).json(category);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to create item category';

      if (errorMessage.includes('required')) {
        return res.status(400).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error creating item category:', error);
    res.status(500).json({ message: 'Error creating item category' });
  }
};

export const updateItemCategory = async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { name, icon } = req.body;

    try {
      const category = await ItemCategoryService.updateItemCategory(categoryId, { name, icon });

      // Track item category updated
      const user = req.user as User;
      if (user) {
        await trackEvent(user.dataValues.id.toString(), 'item_category_updated', {
          category_id: categoryId,
          category_name: name,
        });
      }

      res.json(category);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to update item category';

      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error updating item category:', error);
    res.status(500).json({ message: 'Error updating item category' });
  }
};

export const deleteItemCategory = async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);

    try {
      const { name } = await ItemCategoryService.deleteItemCategory(categoryId);

      // Track item category deleted
      const user = req.user as User;
      if (user) {
        await trackEvent(user.dataValues.id.toString(), 'item_category_deleted', {
          category_id: categoryId,
          category_name: name,
        });
      }

      res.json({ message: 'Item category deleted successfully' });
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Failed to delete item category';

      if (errorMessage.includes('not found')) {
        return res.status(404).json({ message: errorMessage });
      }

      throw serviceError;
    }
  } catch (error) {
    console.error('Error deleting item category:', error);
    res.status(500).json({ message: 'Error deleting item category' });
  }
}; 