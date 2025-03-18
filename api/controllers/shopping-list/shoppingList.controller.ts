import type { Request, Response } from 'express';
import { ShoppingList } from '../../db/models/associations.ts';
import { addNewCategory, replaceCategoryContents } from './shoppingList.service.ts';

// Get entire shopping list for a family group
export const getEntireShoppingList = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;
  const shoppingList = await ShoppingList.findAll({ where: { family_group_id } });
  return res.status(200).json(shoppingList);
};

// Add a new category to a shopping list contents JSON. Returns entire ShoppingList.content JSON
export const addCategory = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;
  const { category_name } = req.body;
  try {
    const shoppingListCategory = await addNewCategory(Number(family_group_id), category_name);
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
    return res.status(200).json(shoppingListCategory);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save category' });
  }
}
