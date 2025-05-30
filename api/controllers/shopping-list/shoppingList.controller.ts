import type { Request, Response } from 'express';
import ShoppingList from '../../db/models/ShoppingList.model.ts';
import ItemCategory from '../../db/models/ItemCategory.model.ts';
import ShoppingListCategory from '../../db/models/ShoppingListCategory.model.ts';
import ShoppingListItem from '../../db/models/ShoppingListItem.model.ts';
import sequelize from '../../db/models/index.ts';
import { Transaction } from 'sequelize';
import { sendShoppingListWebhook } from '../../services/webhook.service.ts';

/**
 * Creates a base shopping list for a family group
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the created shopping list
 */
export const createBaseShoppingList = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;

  const result = await sequelize.transaction(async (t: Transaction) => {
    const shoppingList = await ShoppingList.create(
      { family_group_id: Number(family_group_id) },
      { transaction: t }
    );

    return shoppingList;
  });

  res.json(result);
};

/**
 * Retrieves the entire shopping list for a family group, including all categories and items
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the shopping list with all its categories and items
 */
export const getEntireShoppingList = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;

  // Joining the shopping list with its categories and items
  const shoppingList = await ShoppingList.findOne({
    where: { family_group_id: Number(family_group_id) },
    include: [
      {
        model: ShoppingListCategory,
        as: 'categories',
        include: [
          {
            model: ItemCategory,
            as: 'itemCategory',
          },
          {
            model: ShoppingListItem,
            as: 'items',
            where: { deleted: false },
            required: false,
          },
        ],
      },
    ],
  });

  if (!shoppingList) {
    return res.status(404).json({ message: 'Shopping list not found' });
  }

  res.json(shoppingList);
};

/**
 * Adds a new category to a shopping list
 * @param {Request} req - Express request object containing category name and icon
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the newly created category
 */
export const addCategory = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;
  const { name, icon = null } = req.body;

  if (!name) {
    return res.status(412).json({ message: 'Name is required' });
  }

  const result = await sequelize.transaction(async (t: Transaction) => {
    const shoppingList = await ShoppingList.findOne({
      where: { family_group_id: Number(family_group_id) },
      transaction: t,
    });

    if (!shoppingList) {
      return res.status(404).json({ message: 'Shopping list not found' });
    }

    const itemCategory = await ItemCategory.create(
      { name, icon },
      { transaction: t }
    );

    const shoppingListCategory = await ShoppingListCategory.create(
      {
        shopping_list_id: Number(shoppingList.get('id')),
        item_categories_id: Number(itemCategory.get('id')),
      },
      { transaction: t }
    );

    return shoppingListCategory;
  });

  res.json(result);
};

/**
 * Deletes a category from a family shopping list and soft deletes all its items
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the deleted category
 */
export const deleteCategory = async (req: Request, res: Response) => {
  const { family_group_id, category_id } = req.params;

  const result = await sequelize.transaction(async (t: Transaction) => {
    const shoppingListCategory = await ShoppingListCategory.findOne({
      where: { id: Number(category_id) },
      include: [
        {
          model: ShoppingList,
          where: { family_group_id: Number(family_group_id) },
        },
      ],
      transaction: t,
    });

    if (!shoppingListCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Soft delete all items in the category
    await ShoppingListItem.update(
      { deleted: true },
      {
        where: { shopping_list_categories: Number(category_id) },
        transaction: t,
      }
    );

    // Delete the category
    await shoppingListCategory.destroy({ transaction: t });

    return shoppingListCategory;
  });

  res.json(result);
};

/**
 * Get all categories for a family group
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the categories
 */
export const getFamilyCategories = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;

  if (!family_group_id) {
    return res.status(412).json({ message: 'Family group ID is required' });
  }

  const categories = await ShoppingListCategory.findAll({
    where: { shopping_list_id: Number(family_group_id) },
    include: [
      {
        model: ItemCategory,
        as: 'itemCategory',
      },
    ],
  });

  if (!categories) {
    return res.status(404).json({ message: 'Categories not found' });
  }

  res.json(categories);
};

/**
 * Adds a new item to a shopping list category
 * @param {Request} req - Express request object containing item details
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the newly created item
 */
export const addItem = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;
  const { name, shopping_list_categories } = req.body;

  const result = await sequelize.transaction(async (t: Transaction) => {
    const shoppingList = await ShoppingList.findOne({
      where: { family_group_id: Number(family_group_id) },
      transaction: t,
    });

    if (!shoppingList) {
      return res.status(404).json({ message: 'Shopping list not found' });
    }

    const shoppingListCategory = await ShoppingListCategory.findOne({
      where: { id: Number(shopping_list_categories) },
      transaction: t,
    });

    if (!shoppingListCategory) {
      return res.status(404).json({ message: 'Shopping list category not found' });
    }

    const item = await ShoppingListItem.create(
      {
        shopping_list_id: Number(shoppingList.get('id')),
        shopping_list_categories: Number(shopping_list_categories),
        name,
      },
      { transaction: t }
    );

    return item;
  });

  res.json(result);
};

/**
 * Updates an existing item in a shopping list
 * @param {Request} req - Express request object containing updated item details
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the updated item
 */
export const updateItem = async (req: Request, res: Response) => {
  const { family_group_id, item_id } = req.params;
  const { name, checked, shopping_list_categories } = req.body;

  const result = await sequelize.transaction(async (t: Transaction) => {
    const item = await ShoppingListItem.findOne({
      where: { id: Number(item_id) },
      include: [
        {
          model: ShoppingList,
          where: { family_group_id: Number(family_group_id) },
        },
      ],
      transaction: t,
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (shopping_list_categories) {
      const category = await ShoppingListCategory.findOne({
        where: { id: Number(shopping_list_categories) },
        transaction: t,
      });

      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }
    }

    await item.update(
      { 
        name, 
        checked, 
        shopping_list_categories: shopping_list_categories ? Number(shopping_list_categories) : undefined 
      },
      { transaction: t }
    );

    return item;
  });

  res.json(result);
};

/**
 * Soft deletes an item from a shopping list
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the deleted item
 */
export const deleteItem = async (req: Request, res: Response) => {
  const { family_group_id, item_id } = req.params;

  const result = await sequelize.transaction(async (t: Transaction) => {
    const item = await ShoppingListItem.findOne({
      where: { id: Number(item_id) },
      include: [
        {
          model: ShoppingList,
          where: { family_group_id: Number(family_group_id) },
        },
      ],
      transaction: t,
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    await item.update({ deleted: true }, { transaction: t });

    return item;
  });

  res.json(result);
};
