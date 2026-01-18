import { Transaction } from 'sequelize';
import sequelize from '../db/models/index.ts';
import ShoppingList from '../db/models/ShoppingList.model.ts';
import ItemCategory from '../db/models/ItemCategory.model.ts';
import ShoppingListCategory from '../db/models/ShoppingListCategory.model.ts';
import ShoppingListItem from '../db/models/ShoppingListItem.model.ts';
import { sendShoppingListItemWebhook, sendShoppingListCategoryWebhook } from './webhook.service.ts';

/**
 * Create a base shopping list for a family group with default categories
 * @param {number} familyGroupId - Family group ID
 * @param {number} createdBy - User ID who created the shopping list
 * @returns {Promise<ShoppingList>} Created shopping list
 */
export const createBaseShoppingList = async (familyGroupId: number, createdBy: number): Promise<ShoppingList> => {
  return await sequelize.transaction(async (t: Transaction) => {
    const shoppingList = await ShoppingList.create(
      { family_group_id: familyGroupId },
      { transaction: t }
    );

    // Get all item categories to seed as default shopping list categories
    const itemCategories = await ItemCategory.findAll({
      transaction: t,
    });

    // Create shopping list categories for each item category
    await Promise.all(
      itemCategories.map((itemCategory) =>
        ShoppingListCategory.create(
          {
            shopping_list_id: Number(shoppingList.get('id')),
            item_categories_id: Number(itemCategory.get('id')),
            created_by: createdBy,
          },
          { transaction: t }
        )
      )
    );

    return shoppingList;
  });
};

/**
 * Get entire shopping list with categories and items
 * @param {number} familyGroupId - Family group ID
 * @returns {Promise<ShoppingList | null>} Shopping list with categories and items
 */
export const getEntireShoppingList = async (familyGroupId: number): Promise<ShoppingList | null> => {
  const shoppingList = await ShoppingList.findOne({
    where: { family_group_id: familyGroupId },
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

  return shoppingList;
};

/**
 * Add a category to a shopping list
 * @param {number} familyGroupId - Family group ID
 * @param {number} categoryId - Item category ID
 * @param {number} createdBy - User ID who created the category
 * @returns {Promise<ShoppingListCategory>} Created shopping list category
 * @throws {Error} If shopping list or item category not found
 */
export const addCategory = async (familyGroupId: number, categoryId: number, createdBy: number): Promise<ShoppingListCategory> => {
  return await sequelize.transaction(async (t: Transaction) => {
    const shoppingList = await ShoppingList.findOne({
      where: { family_group_id: familyGroupId },
      transaction: t,
    });

    if (!shoppingList) {
      throw new Error('Shopping list not found');
    }

    const itemCategory = await ItemCategory.findOne({
      where: { id: categoryId },
      transaction: t,
    });

    if (!itemCategory) {
      throw new Error('Item category not found');
    }

    const shoppingListCategory = await ShoppingListCategory.create(
      {
        shopping_list_id: Number(shoppingList.get('id')),
        item_categories_id: categoryId,
        created_by: createdBy,
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
      throw new Error('Failed to create category');
    }

    // Ensure we have the itemCategory data
    if (!completeCategory.itemCategory) {
      completeCategory.itemCategory = itemCategory;
    }

    // Send webhook for category addition
    await sendShoppingListCategoryWebhook(
      familyGroupId,
      'add-category',
      completeCategory
    );

    return completeCategory;
  });
};

/**
 * Delete a category from a shopping list and soft delete all its items
 * @param {number} familyGroupId - Family group ID
 * @param {number} categoryId - Shopping list category ID
 * @returns {Promise<ShoppingListCategory>} Deleted shopping list category
 * @throws {Error} If category not found
 */
export const deleteCategory = async (familyGroupId: number, categoryId: number): Promise<ShoppingListCategory> => {
  return await sequelize.transaction(async (t: Transaction) => {
    const shoppingListCategory = await ShoppingListCategory.findOne({
      where: { id: categoryId },
      include: [
        {
          model: ShoppingList,
          where: { family_group_id: familyGroupId },
        },
      ],
      transaction: t,
    });

    if (!shoppingListCategory) {
      throw new Error('Category not found');
    }

    // Soft delete all items in the category
    await ShoppingListItem.update(
      { deleted: true },
      {
        where: { shopping_list_categories: categoryId },
        transaction: t,
      }
    );

    // Delete the category
    await shoppingListCategory.destroy({ transaction: t });

    // Send webhook for category deletion
    await sendShoppingListCategoryWebhook(
      familyGroupId,
      'delete-category',
      shoppingListCategory
    );

    return shoppingListCategory;
  });
};

/**
 * Get all categories for a shopping list
 * @param {number} familyGroupId - Family group ID
 * @returns {Promise<ShoppingListCategory[]>} Array of shopping list categories
 */
export const getFamilyCategories = async (familyGroupId: number): Promise<ShoppingListCategory[]> => {
  const shoppingList = await ShoppingList.findOne({
    where: { family_group_id: familyGroupId },
  });

  if (!shoppingList) {
    return [];
  }

  const categories = await ShoppingListCategory.findAll({
    where: { shopping_list_id: Number(shoppingList.get('id')) },
    attributes: ['id', 'shopping_list_id', 'item_categories_id', 'created_by', 'created_at', 'updated_at'],
    include: [
      {
        model: ItemCategory,
        as: 'itemCategory',
        attributes: ['id', 'name', 'icon'],
      },
    ],
  });

  return categories;
};

/**
 * Add an item to a shopping list category
 * @param {number} familyGroupId - Family group ID
 * @param {number} categoryId - Shopping list category ID
 * @param {string} name - Item name
 * @param {number} createdBy - User ID who created the item
 * @returns {Promise<ShoppingListItem>} Created shopping list item
 * @throws {Error} If shopping list or category not found
 */
export const addItem = async (familyGroupId: number, categoryId: number, name: string, createdBy: number): Promise<ShoppingListItem> => {
  return await sequelize.transaction(async (t: Transaction) => {
    const shoppingList = await ShoppingList.findOne({
      where: { family_group_id: familyGroupId },
      transaction: t,
    });

    if (!shoppingList) {
      throw new Error('Shopping list not found');
    }

    const shoppingListCategory = await ShoppingListCategory.findOne({
      where: { id: categoryId },
      transaction: t,
    });

    if (!shoppingListCategory) {
      throw new Error('Shopping list category not found');
    }

    const item = await ShoppingListItem.create(
      {
        shopping_list_id: Number(shoppingList.get('id')),
        shopping_list_categories: categoryId,
        name,
        created_by: createdBy,
      },
      { transaction: t }
    );

    // Send webhook for item addition
    await sendShoppingListItemWebhook(
      familyGroupId,
      'add-item',
      item,
      shoppingListCategory
    );

    return item;
  });
};

/**
 * Update an item in a shopping list
 * @param {number} familyGroupId - Family group ID
 * @param {number} itemId - Shopping list item ID
 * @param {string} name - Item name
 * @param {boolean} checked - Checked status
 * @returns {Promise<ShoppingListItem>} Updated shopping list item
 * @throws {Error} If item not found or validation fails
 */
export const updateItem = async (familyGroupId: number, itemId: number, name: string, checked: boolean): Promise<ShoppingListItem> => {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Name must be a non-empty string');
  }

  if (typeof checked !== 'boolean') {
    throw new Error('Checked status must be a boolean');
  }

  return await sequelize.transaction(async (t: Transaction) => {
    const item = await ShoppingListItem.findOne({
      where: { id: itemId },
      include: [
        {
          model: ShoppingList,
          where: { family_group_id: familyGroupId },
        },
        {
          model: ShoppingListCategory,
          required: true
        }
      ],
      transaction: t,
    });

    if (!item) {
      throw new Error('Item not found');
    }

    const previousChecked = item.get('checked');
    await item.update(
      { name, checked },
      { transaction: t }
    );

    // Send webhook for item check/uncheck
    if (checked !== previousChecked) {
      await sendShoppingListItemWebhook(
        familyGroupId,
        checked ? 'check-item' : 'uncheck-item',
        item,
        item.category
      );
    }

    return item;
  });
};

/**
 * Soft delete an item from a shopping list
 * @param {number} familyGroupId - Family group ID
 * @param {number} itemId - Shopping list item ID
 * @returns {Promise<ShoppingListItem>} Deleted shopping list item
 * @throws {Error} If item not found
 */
export const deleteItem = async (familyGroupId: number, itemId: number): Promise<ShoppingListItem> => {
  return await sequelize.transaction(async (t: Transaction) => {
    const item = await ShoppingListItem.findOne({
      where: { id: itemId },
      include: [
        {
          model: ShoppingList,
          where: { family_group_id: familyGroupId },
        },
        {
          model: ShoppingListCategory,
          required: true
        }
      ],
      transaction: t,
    });

    if (!item) {
      throw new Error('Item not found');
    }

    await item.update({ deleted: true }, { transaction: t });

    // Send webhook for item deletion
    await sendShoppingListItemWebhook(
      familyGroupId,
      'delete-item',
      item,
      item.category
    );

    return item;
  });
};
