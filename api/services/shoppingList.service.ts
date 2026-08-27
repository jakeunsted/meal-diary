import { Transaction } from 'sequelize';
import {
  categorizeShoppingItemName,
  isShoppingCategory,
  type ShoppingCategory,
} from '@meal-diary/shared';
import sequelize from '../db/models/index.ts';
import ShoppingList from '../db/models/ShoppingList.model.ts';
import ShoppingListItem from '../db/models/ShoppingListItem.model.ts';
import { sendShoppingListItemWebhook } from './webhook.service.ts';

const resolveItemCategory = (
  name: string,
  category?: ShoppingCategory | string | null
): ShoppingCategory => {
  if (isShoppingCategory(category)) {
    return category;
  }
  return categorizeShoppingItemName(name);
};

const nextPositionInCategory = async (
  shoppingListId: number,
  category: ShoppingCategory,
  transaction: Transaction
): Promise<number> => {
  const maxPosition = await ShoppingListItem.max('position', {
    where: {
      shopping_list_id: shoppingListId,
      category,
      deleted: false,
    },
    transaction,
  });

  return typeof maxPosition === 'number' ? maxPosition + 1 : 0;
};

/**
 * Create a base shopping list for a family group
 * @param {number} familyGroupId - Family group ID
 * @param {number} createdBy - User ID who created the shopping list
 * @returns {Promise<ShoppingList>} Created shopping list
 */
export const createBaseShoppingList = async (familyGroupId: number, createdBy: number): Promise<ShoppingList> => {
  return await sequelize.transaction(async (t: Transaction) => {
    return ShoppingList.create(
      { family_group_id: familyGroupId },
      { transaction: t }
    );
  });
};

/**
 * Get entire shopping list with items.
 * If a shopping list does not exist for the family group, it will be created.
 * @param {number} familyGroupId - Family group ID
 * @returns {Promise<ShoppingList | null>} Shopping list with items
 */
export const getEntireShoppingList = async (familyGroupId: number): Promise<ShoppingList | null> => {
  // Ensure there is exactly one shopping list per family group.
  const existingList = await ShoppingList.findOne({
    where: { family_group_id: familyGroupId },
  });

  if (!existingList) {
    try {
      await ShoppingList.create({ family_group_id: familyGroupId });
    } catch (error) {
      console.error('Error creating shopping list for family group:', error);
    }
  }

  const shoppingList = await ShoppingList.findOne({
    where: { family_group_id: familyGroupId },
    attributes: ['id', 'family_group_id', 'created_at', 'updated_at'],
    include: [
      {
        model: ShoppingListItem,
        as: 'items',
        where: { deleted: false },
        required: false,
        attributes: [
          'id',
          'shopping_list_id',
          'name',
          'checked',
          'deleted',
          'created_by',
          'category',
          'position',
          'created_at',
          'updated_at'
        ],
      },
    ],
    order: [
      [{ model: ShoppingListItem, as: 'items' }, 'category', 'ASC'],
      [{ model: ShoppingListItem, as: 'items' }, 'position', 'ASC'],
    ],
  });

  return shoppingList;
};

/**
 * Add an item to a shopping list
 * @param {number} familyGroupId - Family group ID
 * @param {string} name - Item name
 * @param {number} createdBy - User ID who created the item
 * @param {ShoppingCategory} [category] - Optional explicit category; auto-categorized when omitted
 * @returns {Promise<ShoppingListItem>} Created shopping list item
 * @throws {Error} If shopping list not found
 */
export const addItem = async (
  familyGroupId: number,
  name: string,
  createdBy: number,
  category?: ShoppingCategory | string | null
): Promise<ShoppingListItem> => {
  return await sequelize.transaction(async (t: Transaction) => {
    const shoppingList = await ShoppingList.findOne({
      where: { family_group_id: familyGroupId },
      transaction: t,
    });

    if (!shoppingList) {
      throw new Error('Shopping list not found');
    }

    const resolvedCategory = resolveItemCategory(name, category);
    const shoppingListId = Number(shoppingList.get('id'));
    const nextPosition = await nextPositionInCategory(shoppingListId, resolvedCategory, t);

    const item = await ShoppingListItem.create(
      {
        shopping_list_id: shoppingListId,
        name,
        created_by: createdBy,
        category: resolvedCategory,
        position: nextPosition,
      },
      { transaction: t }
    );

    await sendShoppingListItemWebhook(
      familyGroupId,
      'add-item',
      item,
      createdBy
    );

    return item;
  });
};

/**
 * Add multiple items to a shopping list in a single operation.
 * All items are appended to the end of their respective categories.
 * @param {number} familyGroupId - Family group ID
 * @param {{ name: string; category?: ShoppingCategory | string | null }[]} items - Items to add
 * @param {number} createdBy - User ID who created the items
 * @returns {Promise<ShoppingListItem[]>} Created shopping list items
 */
export const bulkAddItems = async (
  familyGroupId: number,
  items: { name: string; category?: ShoppingCategory | string | null }[],
  createdBy: number
): Promise<ShoppingListItem[]> => {
  if (!items.length) {
    return [];
  }

  return await sequelize.transaction(async (t: Transaction) => {
    const shoppingList = await ShoppingList.findOne({
      where: { family_group_id: familyGroupId },
      transaction: t,
    });

    if (!shoppingList) {
      throw new Error('Shopping list not found');
    }

    const shoppingListId = Number(shoppingList.get('id'));
    const createdItems: ShoppingListItem[] = [];

    for (const payload of items) {
      const resolvedCategory = resolveItemCategory(payload.name, payload.category);
      const nextPosition = await nextPositionInCategory(shoppingListId, resolvedCategory, t);

      const item = await ShoppingListItem.create(
        {
          shopping_list_id: shoppingListId,
          name: payload.name,
          created_by: createdBy,
          category: resolvedCategory,
          position: nextPosition,
        },
        { transaction: t }
      );

      createdItems.push(item);

      await sendShoppingListItemWebhook(
        familyGroupId,
        'add-item',
        item,
        createdBy
      );
    }

    return createdItems;
  });
};

/**
 * Update an item in a shopping list. Either field may be omitted to support
 * partial updates (e.g. rename without toggling checked, or vice versa).
 * When category changes, the item is appended to the end of the target category.
 * @param {number} familyGroupId - Family group ID
 * @param {number} itemId - Shopping list item ID
 * @param {{ name?: string; checked?: boolean; category?: ShoppingCategory | string }} updates - Fields to update
 * @param {number} [actorUserId] - The id of the user performing the update
 * @returns {Promise<ShoppingListItem>} Updated shopping list item
 * @throws {Error} If item not found or validation fails
 */
export const updateItem = async (
  familyGroupId: number,
  itemId: number,
  updates: { name?: string; checked?: boolean; category?: ShoppingCategory | string },
  actorUserId?: number
): Promise<ShoppingListItem> => {
  const { name, checked, category } = updates;

  if (name === undefined && checked === undefined && category === undefined) {
    throw new Error('At least one of name, checked or category must be provided');
  }

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    throw new Error('Name must be a non-empty string');
  }

  if (checked !== undefined && typeof checked !== 'boolean') {
    throw new Error('Checked status must be a boolean');
  }

  if (category !== undefined && !isShoppingCategory(category)) {
    throw new Error('Category must be a valid shopping category');
  }

  return await sequelize.transaction(async (t: Transaction) => {
    const item = await ShoppingListItem.findOne({
      where: { id: itemId },
      include: [
        {
          model: ShoppingList,
          where: { family_group_id: familyGroupId },
        },
      ],
      transaction: t,
    });

    if (!item) {
      throw new Error('Item not found');
    }

    const previousChecked = item.get('checked');
    const previousCategory = String(item.get('category'));
    const changes: { name?: string; checked?: boolean; category?: string; position?: number } = {};

    if (name !== undefined) {
      changes.name = name;
    }
    if (checked !== undefined) {
      changes.checked = checked;
    }
    if (
      category !== undefined &&
      isShoppingCategory(category) &&
      category !== previousCategory
    ) {
      changes.category = category;
      changes.position = await nextPositionInCategory(
        Number(item.get('shopping_list_id')),
        category,
        t
      );
    }

    await item.update(changes, { transaction: t });

    if (checked !== undefined && checked !== previousChecked) {
      await sendShoppingListItemWebhook(
        familyGroupId,
        checked ? 'check-item' : 'uncheck-item',
        item,
        actorUserId
      );
    } else if (
      category !== undefined &&
      isShoppingCategory(category) &&
      category !== previousCategory
    ) {
      await sendShoppingListItemWebhook(
        familyGroupId,
        'move-item',
        item,
        actorUserId
      );
    }

    return item;
  });
};

/**
 * Update multiple items in a shopping list in a single transaction. Each update
 * may set name, checked, deleted and/or category, supporting partial updates per item.
 * The `deleted` flag enables un-deleting items (used by Undo).
 * When category changes, the item is appended to the end of the target category.
 * @param {number} familyGroupId - Family group ID
 * @param {{ id: number; name?: string; checked?: boolean; deleted?: boolean; category?: ShoppingCategory | string }[]} updates - Items to update
 * @param {number} [actorUserId] - The id of the user performing the update
 * @returns {Promise<ShoppingListItem[]>} Updated shopping list items
 * @throws {Error} If any item is not found or validation fails
 */
export const bulkUpdateItems = async (
  familyGroupId: number,
  updates: {
    id: number;
    name?: string;
    checked?: boolean;
    deleted?: boolean;
    category?: ShoppingCategory | string;
  }[],
  actorUserId?: number
): Promise<ShoppingListItem[]> => {
  if (!updates.length) {
    return [];
  }

  for (const update of updates) {
    if (!update.id || isNaN(Number(update.id))) {
      throw new Error('Each update must include a valid id');
    }
    if (
      update.name === undefined &&
      update.checked === undefined &&
      update.deleted === undefined &&
      update.category === undefined
    ) {
      throw new Error('At least one of name, checked, deleted or category must be provided');
    }
    if (update.name !== undefined && (typeof update.name !== 'string' || !update.name.trim())) {
      throw new Error('Name must be a non-empty string');
    }
    if (update.checked !== undefined && typeof update.checked !== 'boolean') {
      throw new Error('Checked status must be a boolean');
    }
    if (update.deleted !== undefined && typeof update.deleted !== 'boolean') {
      throw new Error('Deleted status must be a boolean');
    }
    if (update.category !== undefined && !isShoppingCategory(update.category)) {
      throw new Error('Category must be a valid shopping category');
    }
  }

  return await sequelize.transaction(async (t: Transaction) => {
    const updatedItems: ShoppingListItem[] = [];

    for (const update of updates) {
      const item = await ShoppingListItem.findOne({
        where: { id: update.id },
        include: [
          {
            model: ShoppingList,
            where: { family_group_id: familyGroupId },
          },
        ],
        transaction: t,
      });

      if (!item) {
        throw new Error('Item not found');
      }

      const previousChecked = item.get('checked');
      const previousCategory = String(item.get('category'));
      const changes: {
        name?: string;
        checked?: boolean;
        deleted?: boolean;
        category?: string;
        position?: number;
      } = {};

      if (update.name !== undefined) {
        changes.name = update.name;
      }
      if (update.checked !== undefined) {
        changes.checked = update.checked;
      }
      if (update.deleted !== undefined) {
        changes.deleted = update.deleted;
      }
      if (
        update.category !== undefined &&
        isShoppingCategory(update.category) &&
        update.category !== previousCategory
      ) {
        changes.category = update.category;
        changes.position = await nextPositionInCategory(
          Number(item.get('shopping_list_id')),
          update.category,
          t
        );
      }

      await item.update(changes, { transaction: t });

      if (update.checked !== undefined && update.checked !== previousChecked) {
        await sendShoppingListItemWebhook(
          familyGroupId,
          update.checked ? 'check-item' : 'uncheck-item',
          item,
          actorUserId
        );
      } else if (update.category !== undefined && update.category !== previousCategory) {
        await sendShoppingListItemWebhook(
          familyGroupId,
          'move-item',
          item,
          actorUserId
        );
      }

      updatedItems.push(item);
    }

    return updatedItems;
  });
};

/**
 * Reorder items in a shopping list by updating their category and position.
 * @param {number} familyGroupId - Family group ID
 * @param {{ id: number; category: ShoppingCategory | string; position: number }[]} changes - Items to reorder
 * @param {number} [actorUserId] - The id of the user performing the reorder
 * @returns {Promise<ShoppingListItem[]>} Updated shopping list items
 * @throws {Error} If any item is not found or category is invalid
 */
export const reorderItems = async (
  familyGroupId: number,
  changes: { id: number; category: ShoppingCategory | string; position: number }[],
  actorUserId?: number
): Promise<ShoppingListItem[]> => {
  if (!changes.length) {
    return [];
  }

  for (const change of changes) {
    if (!isShoppingCategory(change.category)) {
      throw new Error('Category must be a valid shopping category');
    }
    if (typeof change.position !== 'number' || Number.isNaN(change.position)) {
      throw new Error('Position must be a number');
    }
  }

  return await sequelize.transaction(async (t: Transaction) => {
    const updatedItems: ShoppingListItem[] = [];

    for (const change of changes) {
      const item = await ShoppingListItem.findOne({
        where: { id: change.id },
        include: [
          {
            model: ShoppingList,
            where: { family_group_id: familyGroupId },
          },
        ],
        transaction: t,
      }) as ShoppingListItem;

      if (!item) {
        throw new Error('Item not found');
      }

      await item.update(
        {
          category: change.category,
          position: change.position,
        },
        { transaction: t }
      );

      updatedItems.push(item);

      await sendShoppingListItemWebhook(
        familyGroupId,
        'move-item',
        item,
        actorUserId
      );
    }

    return updatedItems;
  });
};

/**
 * Soft delete an item from a shopping list
 * @param {number} familyGroupId - Family group ID
 * @param {number} itemId - Shopping list item ID
 * @param {number} [actorUserId] - The id of the user performing the delete
 * @returns {Promise<ShoppingListItem>} Deleted shopping list item
 * @throws {Error} If item not found
 */
export const deleteItem = async (familyGroupId: number, itemId: number, actorUserId?: number): Promise<ShoppingListItem> => {
  return await sequelize.transaction(async (t: Transaction) => {
    const item = await ShoppingListItem.findOne({
      where: { id: itemId },
      include: [
        {
          model: ShoppingList,
          where: { family_group_id: familyGroupId },
        },
      ],
      transaction: t,
    });

    if (!item) {
      throw new Error('Item not found');
    }

    await item.update({ deleted: true }, { transaction: t });

    await sendShoppingListItemWebhook(
      familyGroupId,
      'delete-item',
      item,
      actorUserId
    );

    return item;
  });
};

/**
 * Soft delete multiple items from a shopping list in a single transaction.
 * @param {number} familyGroupId - Family group ID
 * @param {number[]} ids - Item ids to delete
 * @param {number} [actorUserId] - The id of the user performing the delete
 * @returns {Promise<ShoppingListItem[]>} Deleted shopping list items
 * @throws {Error} If any item is not found
 */
export const bulkDeleteItems = async (
  familyGroupId: number,
  ids: number[],
  actorUserId?: number
): Promise<ShoppingListItem[]> => {
  if (!ids.length) {
    return [];
  }

  return await sequelize.transaction(async (t: Transaction) => {
    const deletedItems: ShoppingListItem[] = [];

    for (const id of ids) {
      const item = await ShoppingListItem.findOne({
        where: { id },
        include: [
          {
            model: ShoppingList,
            where: { family_group_id: familyGroupId },
          },
        ],
        transaction: t,
      });

      if (!item) {
        throw new Error('Item not found');
      }

      await item.update({ deleted: true }, { transaction: t });

      await sendShoppingListItemWebhook(
        familyGroupId,
        'delete-item',
        item,
        actorUserId
      );

      deletedItems.push(item);
    }

    return deletedItems;
  });
};
