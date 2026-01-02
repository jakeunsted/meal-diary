import type { Request, Response } from 'express';
import ShoppingList from '../../db/models/ShoppingList.model.ts';
import ItemCategory from '../../db/models/ItemCategory.model.ts';
import ShoppingListCategory from '../../db/models/ShoppingListCategory.model.ts';
import ShoppingListItem from '../../db/models/ShoppingListItem.model.ts';
import sequelize from '../../db/models/index.ts';
import { Transaction } from 'sequelize';
import { sendShoppingListItemWebhook, sendShoppingListCategoryWebhook } from '../../services/webhook.service.ts';
import { User } from '../../db/models/associations.ts';

/**
 * Creates a base shopping list for a family group
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the created shopping list
 */
export const createBaseShoppingList = async (req: Request, res: Response) => {
  const { family_group_id } = req.params;
  const user = req.user as User;

  const result = await sequelize.transaction(async (t: Transaction) => {
    const shoppingList = await ShoppingList.create(
      { family_group_id: Number(family_group_id) },
      { transaction: t }
    );

    // Get all item categories to seed as default shopping list categories
    const itemCategories = await ItemCategory.findAll({
      transaction: t,
    });

    // Create shopping list categories for each item category
    const shoppingListCategories = await Promise.all(
      itemCategories.map((itemCategory) =>
        ShoppingListCategory.create(
          {
            shopping_list_id: Number(shoppingList.get('id')),
            item_categories_id: Number(itemCategory.get('id')),
            created_by: Number(user.dataValues.id),
          },
          { transaction: t }
        )
      )
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
    attributes: ['id', 'family_group_id', 'created_at', 'updated_at'],
    include: [
      {
        model: ShoppingListCategory,
        as: 'categories',
        attributes: ['id', 'shopping_list_id', 'item_categories_id', 'created_by', 'created_at', 'updated_at'],
        include: [
          {
            model: ItemCategory,
            as: 'itemCategory',
            attributes: ['id', 'name', 'icon'],
          },
          {
            model: ShoppingListItem,
            as: 'items',
            where: { deleted: false },
            required: false,
            attributes: ['id', 'shopping_list_id', 'shopping_list_categories', 'name', 'checked', 'deleted', 'created_by', 'created_at', 'updated_at'],
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
  const { family_group_id, category_id } = req.params;

  if (!category_id) {
    return res.status(412).json({ message: 'Category ID is required' });
  }
  
  const user = req.user as User;

  const result = await sequelize.transaction(async (t: Transaction) => {
    const shoppingList = await ShoppingList.findOne({
      where: { family_group_id: Number(family_group_id) },
      transaction: t,
    });

    if (!shoppingList) {
      return res.status(404).json({ message: 'Shopping list not found' });
    }

    const itemCategory = await ItemCategory.findOne({
      where: { id: Number(category_id) },
      transaction: t,
    });

    if (!itemCategory) {
      return res.status(404).json({ message: 'Item category not found' });
    }

    const shoppingListCategory = await ShoppingListCategory.create(
      {
        shopping_list_id: Number(shoppingList.get('id')),
        item_categories_id: Number(itemCategory.get('id')),
        created_by: Number(user.dataValues.id),
      },
      { transaction: t }
    );

    // Fetch the complete category data with items
    const completeCategory = await ShoppingListCategory.findOne({
      where: { id: Number(shoppingListCategory.get('id')) },
      include: [
        {
          model: ItemCategory,
          as: 'itemCategory',
          attributes: ['id', 'name', 'icon']
        },
        {
          model: ShoppingListItem,
          as: 'items',
          where: { deleted: false },
          required: false
        }
      ],
      transaction: t
    }) as any;

    if (!completeCategory) {
      return res.status(500).json({ message: 'Failed to create category' });
    }

    // Ensure we have the itemCategory data
    if (!completeCategory.itemCategory) {
      completeCategory.itemCategory = itemCategory;
    }

    // Send webhook for category addition
    await sendShoppingListCategoryWebhook(
      Number(family_group_id),
      'add-category',
      completeCategory
    );

    return completeCategory;
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

    // Send webhook for category deletion
    await sendShoppingListCategoryWebhook(
      Number(family_group_id),
      'delete-category',
      shoppingListCategory
    );

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
    attributes: ['id', 'shopping_list_id', 'item_categories_id', 'created_by', 'created_at', 'updated_at'],
    include: [
      {
        model: ItemCategory,
        as: 'itemCategory',
        attributes: ['id', 'name', 'icon'],
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

  const user = req.user as User;

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
        created_by: Number(user.dataValues.id),
      },
      { transaction: t }
    );

    // Send webhook for item addition
    await sendShoppingListItemWebhook(
      Number(family_group_id),
      'add-item',
      item,
      shoppingListCategory
    );

    return item;
  });

  res.json(result);
};

/**
 * Updates an existing item in a shopping list category
 * @param {Request} req - Express request object containing updated item details
 * @param {Response} res - Express response object
 * @returns {Promise<void>} - Returns the updated item
 */
export const updateItem = async (req: Request, res: Response) => {
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

  // Validate field types
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'Name must be a non-empty string' });
  }

  if (typeof checked !== 'boolean') {
    return res.status(400).json({ message: 'Checked status must be a boolean' });
  }

  const result = await sequelize.transaction(async (t: Transaction) => {
    const item = await ShoppingListItem.findOne({
      where: { id: Number(item_id) },
      include: [
        {
          model: ShoppingList,
          where: { family_group_id: Number(family_group_id) },
        },
        {
          model: ShoppingListCategory,
          required: true
        }
      ],
      transaction: t,
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const previousChecked = item.get('checked');
    await item.update(
      { name, checked },
      { transaction: t }
    );

    // Send webhook for item check/uncheck
    if (checked !== previousChecked) {
      await sendShoppingListItemWebhook(
        Number(family_group_id),
        checked ? 'check-item' : 'uncheck-item',
        item,
        item.category
      );
    }

    return item;
  });

  if (!result) {
    return res.status(500).json({ message: 'Failed to update item' });
  }

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
        {
          model: ShoppingListCategory,
          required: true
        }
      ],
      transaction: t,
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    await item.update({ deleted: true }, { transaction: t });

    // Send webhook for item deletion
    await sendShoppingListItemWebhook(
      Number(family_group_id),
      'delete-item',
      item,
      item.category
    );

    return item;
  });

  res.json(result);
};
