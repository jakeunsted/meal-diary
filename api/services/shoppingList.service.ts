import { Transaction } from 'sequelize';
import sequelize from '../db/models/index.ts';
import ShoppingList from '../db/models/ShoppingList.model.ts';
import ShoppingListItem from '../db/models/ShoppingListItem.model.ts';
import { sendShoppingListItemWebhook } from './webhook.service.ts';

const assertValidShoppingListParent = async (
  shoppingListId: number,
  parentItemId: number | null,
  transaction: Transaction
): Promise<void> => {
  if (parentItemId === null) {
    return;
  }

  const parent = await ShoppingListItem.findOne({
    where: {
      id: parentItemId,
      shopping_list_id: shoppingListId,
      parent_item_id: null,
      deleted: false,
    },
    transaction,
  });

  if (!parent) {
    throw new Error('Invalid parent item: shopping list items can only be nested one level deep');
  }
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
          'parent_item_id',
          'position',
          'created_at',
          'updated_at'
        ],
      },
    ],
    order: [
      [{ model: ShoppingListItem, as: 'items' }, 'parent_item_id', 'ASC'],
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
 * @returns {Promise<ShoppingListItem>} Created shopping list item
 * @throws {Error} If shopping list not found
 */
export const addItem = async (
  familyGroupId: number,
  name: string,
  createdBy: number,
  parentItemId?: number | null
): Promise<ShoppingListItem> => {
  return await sequelize.transaction(async (t: Transaction) => {
    const shoppingList = await ShoppingList.findOne({
      where: { family_group_id: familyGroupId },
      transaction: t,
    });

    if (!shoppingList) {
      throw new Error('Shopping list not found');
    }

    const resolvedParentId = parentItemId ?? null;
    await assertValidShoppingListParent(Number(shoppingList.get('id')), resolvedParentId, t);

    const maxPosition = await ShoppingListItem.max('position', {
      where: {
        shopping_list_id: Number(shoppingList.get('id')),
        parent_item_id: resolvedParentId,
        deleted: false,
      },
      transaction: t,
    });

    const nextPosition = typeof maxPosition === 'number' ? maxPosition + 1 : 0;

    const item = await ShoppingListItem.create(
      {
        shopping_list_id: Number(shoppingList.get('id')),
        name,
        created_by: createdBy,
        parent_item_id: resolvedParentId,
        position: nextPosition,
      },
      { transaction: t }
    );

    // Send webhook for item addition
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
 * All items are appended to the end of their respective sibling groups.
 * @param {number} familyGroupId - Family group ID
 * @param {{ name: string; parent_item_id?: number | null }[]} items - Items to add
 * @param {number} createdBy - User ID who created the items
 * @returns {Promise<ShoppingListItem[]>} Created shopping list items
 */
export const bulkAddItems = async (
  familyGroupId: number,
  items: { name: string; parent_item_id?: number | null }[],
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

    const createdItems: ShoppingListItem[] = [];

    for (const payload of items) {
      const resolvedParentId = payload.parent_item_id ?? null;
      await assertValidShoppingListParent(Number(shoppingList.get('id')), resolvedParentId, t);

      const maxPosition = await ShoppingListItem.max('position', {
        where: {
          shopping_list_id: Number(shoppingList.get('id')),
          parent_item_id: resolvedParentId,
          deleted: false,
        },
        transaction: t,
      });

      const nextPosition = typeof maxPosition === 'number' ? maxPosition + 1 : 0;

      const item = await ShoppingListItem.create(
        {
          shopping_list_id: Number(shoppingList.get('id')),
          name: payload.name,
          created_by: createdBy,
          parent_item_id: resolvedParentId,
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
 * @param {number} familyGroupId - Family group ID
 * @param {number} itemId - Shopping list item ID
 * @param {{ name?: string; checked?: boolean }} updates - Fields to update
 * @param {number} [actorUserId] - The id of the user performing the update
 * @returns {Promise<ShoppingListItem>} Updated shopping list item
 * @throws {Error} If item not found or validation fails
 */
export const updateItem = async (
  familyGroupId: number,
  itemId: number,
  updates: { name?: string; checked?: boolean },
  actorUserId?: number
): Promise<ShoppingListItem> => {
  const { name, checked } = updates;

  if (name === undefined && checked === undefined) {
    throw new Error('At least one of name or checked must be provided');
  }

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    throw new Error('Name must be a non-empty string');
  }

  if (checked !== undefined && typeof checked !== 'boolean') {
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
      ],
      transaction: t,
    });

    if (!item) {
      throw new Error('Item not found');
    }

    const previousChecked = item.get('checked');
    const changes: { name?: string; checked?: boolean } = {};
    if (name !== undefined) {
      changes.name = name;
    }
    if (checked !== undefined) {
      changes.checked = checked;
    }
    await item.update(changes, { transaction: t });

    // Send webhook for item check/uncheck
    if (checked !== undefined && checked !== previousChecked) {
      await sendShoppingListItemWebhook(
        familyGroupId,
        checked ? 'check-item' : 'uncheck-item',
        item,
        actorUserId
      );
    }

    return item;
  });
};

/**
 * Update multiple items in a shopping list in a single transaction. Each update
 * may set name, checked and/or deleted, supporting partial updates per item.
 * The `deleted` flag enables un-deleting items (used by Undo).
 * @param {number} familyGroupId - Family group ID
 * @param {{ id: number; name?: string; checked?: boolean; deleted?: boolean }[]} updates - Items to update
 * @param {number} [actorUserId] - The id of the user performing the update
 * @returns {Promise<ShoppingListItem[]>} Updated shopping list items
 * @throws {Error} If any item is not found or validation fails
 */
export const bulkUpdateItems = async (
  familyGroupId: number,
  updates: { id: number; name?: string; checked?: boolean; deleted?: boolean }[],
  actorUserId?: number
): Promise<ShoppingListItem[]> => {
  if (!updates.length) {
    return [];
  }

  for (const update of updates) {
    if (!update.id || isNaN(Number(update.id))) {
      throw new Error('Each update must include a valid id');
    }
    if (update.name === undefined && update.checked === undefined && update.deleted === undefined) {
      throw new Error('At least one of name, checked or deleted must be provided');
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
      const changes: { name?: string; checked?: boolean; deleted?: boolean } = {};
      if (update.name !== undefined) {
        changes.name = update.name;
      }
      if (update.checked !== undefined) {
        changes.checked = update.checked;
      }
      if (update.deleted !== undefined) {
        changes.deleted = update.deleted;
      }
      await item.update(changes, { transaction: t });

      // Send webhook for item check/uncheck
      if (update.checked !== undefined && update.checked !== previousChecked) {
        await sendShoppingListItemWebhook(
          familyGroupId,
          update.checked ? 'check-item' : 'uncheck-item',
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
 * Reorder items in a shopping list by updating their parent_item_id and position.
 * @param {number} familyGroupId - Family group ID
 * @param {{ id: number; parent_item_id: number | null; position: number }[]} changes - Items to reorder
 * @param {number} [actorUserId] - The id of the user performing the reorder
 * @returns {Promise<ShoppingListItem[]>} Updated shopping list items
 * @throws {Error} If any item is not found or does not belong to the family group
 */
export const reorderItems = async (
  familyGroupId: number,
  changes: { id: number; parent_item_id: number | null; position: number }[],
  actorUserId?: number
): Promise<ShoppingListItem[]> => {
  if (!changes.length) {
    return [];
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

      const resolvedParentId = change.parent_item_id ?? null;
      await assertValidShoppingListParent(Number(item.get('shopping_list_id')), resolvedParentId, t);

      await item.update(
        {
          parent_item_id: resolvedParentId,
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

    // Send webhook for item deletion
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

      // Send webhook for item deletion
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
