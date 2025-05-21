import type { Request, Response } from 'express';
import { ShoppingList } from '../../db/models/associations.ts';
import { addNewCategory, replaceCategoryContents, deleteCategoryByName } from '../../services/shoppingList.service.ts';
import { sendShoppingListWebhook } from '../../services/webhook.service.ts';

// Create a base shopping list for a family group
export const createBaseShoppingList = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;
  const shoppingList = await ShoppingList.create({ family_group_id: Number(family_group_id) });
  return res.status(200).json(shoppingList);
};

// Get entire shopping list for a family group
export const getEntireShoppingList = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;
  if (!family_group_id) {
    return res.status(412).json({ message: 'Family group ID is required' });
  }
  const shoppingList = await ShoppingList.findOne({ where: { family_group_id: Number(family_group_id) } });
  return res.status(200).json(shoppingList);
};

// Add a new category to a shopping list contents JSON. Returns entire ShoppingList.content JSON
export const addCategory = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;
  const { category_name } = req.body;
  if (!family_group_id || !category_name) {
    return res.status(412).json({ message: 'Family group ID and category name are required' });
  }
  try {
    const shoppingListCategory = await addNewCategory(Number(family_group_id), category_name);
    sendShoppingListWebhook(
      Number(family_group_id),
      shoppingListCategory.name,
      shoppingListCategory,
      'add-new-category'
    )
    // return res.status(200)
    return res.status(200).json(shoppingListCategory);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add new category' });
  }
};

// Save category by replacing its category contents with new values
export const saveCategory = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;
  const { category_name, category_contents } = req.body;
  try {
    const shoppingListCategory = await replaceCategoryContents(Number(family_group_id), category_name, category_contents);
    sendShoppingListWebhook(
      Number(family_group_id),
      shoppingListCategory.name,
      shoppingListCategory,
      'save-category'
    )
    // return res.status(200)
    return res.status(200).json(shoppingListCategory);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save category' });
  }
}

// Delete a category from the shopping list
export const deleteCategory = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;
  const { category_name } = req.query;
  if (!family_group_id || !category_name) {
    return res.status(412).json({ message: 'Family group ID and category name are required' });
  }
  try {
    const shoppingListCategory = await deleteCategoryByName(Number(family_group_id), category_name as string);
    sendShoppingListWebhook(
      Number(family_group_id),
      category_name as string,
      null,
      'delete-category'
    )
    return res.status(200).json(shoppingListCategory);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete category' });
  }
}

// Update the order of categories in the shopping list
export const updateCategoryOrder = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;
  const { categories } = req.body;
  if (!family_group_id || !categories || !Array.isArray(categories)) {
    return res.status(412).json({ message: 'Family group ID and categories array are required' });
  }
  try {
    const shoppingList = await ShoppingList.findOne({ where: { family_group_id: Number(family_group_id) } });
    if (!shoppingList) {
      return res.status(404).json({ message: 'Shopping list not found' });
    }

    // Update the categories order in the content
    const updatedContent = {
      categories: categories.map(category => ({
        name: category.name,
        items: category.items
      }))
    };

    // Use update method directly with the new content
    await shoppingList.update({ content: updatedContent });

    // Send webhook for each category update
    for (const category of categories) {
      sendShoppingListWebhook(
        Number(family_group_id),
        category.name,
        category,
        'update-category-order'
      );
    }

    // Fetch the updated shopping list to return
    const updatedShoppingList = await ShoppingList.findOne({ 
      where: { family_group_id: Number(family_group_id) } 
    });

    return res.status(200).json(updatedShoppingList);
  } catch (error) {
    console.error('Error updating category order:', error);
    return res.status(500).json({ message: 'Failed to update category order' });
  }
};
