import { describe, expect, it } from 'vitest';

import {
  flattenShoppingListItems,
  generateTempShoppingListItemId,
  getActiveFlatShoppingListItems,
  insertShoppingListItemAfter,
  isTempShoppingListItemId,
} from '@/lib/shopping-list/shoppingListTree';
import type { ShoppingListItem } from '@/types/shoppingList';

const item = (overrides: Partial<ShoppingListItem>): ShoppingListItem => ({
  id: 1,
  shopping_list_id: 1,
  name: 'Item',
  checked: false,
  deleted: false,
  created_by: 1,
  category: 'other',
  position: 0,
  created_at: '',
  updated_at: '',
  ...overrides,
});

describe('shopping list tree', () => {
  it('flattens by category and hides checked items from the active list', () => {
    const items = [
      item({ id: 2, name: 'Bread', category: 'bakery', position: 0 }),
      item({ id: 1, name: 'Chicken', category: 'meat', position: 0, checked: true }),
      item({ id: 3, name: 'Beef', category: 'meat', position: 1 }),
    ];

    expect(flattenShoppingListItems(items).map((entry) => entry.id)).toEqual([1, 3, 2]);
    expect(getActiveFlatShoppingListItems(items).map((entry) => entry.id)).toEqual([3, 2]);
  });

  it('recognises generated temp ids', () => {
    const tempId = generateTempShoppingListItemId();
    expect(isTempShoppingListItemId(tempId)).toBe(true);
    expect(isTempShoppingListItemId(4)).toBe(false);
  });

  it('inserts a temp item after an anchor and returns null when the anchor is missing', () => {
    const inserted = insertShoppingListItemAfter(
      [
        item({ id: 1, category: 'dairy', position: 0 }),
        item({ id: 2, category: 'dairy', position: 1 }),
      ],
      7,
      1,
      3,
      'Yogurt'
    );

    expect(inserted).not.toBeNull();
    expect(isTempShoppingListItemId(inserted!.tempItem.id)).toBe(true);
    const dairy = inserted!.items
      .filter((entry) => entry.category === 'dairy')
      .sort((a, b) => a.position - b.position);
    expect(dairy.map((entry) => entry.name)).toEqual(['Item', 'Yogurt', 'Item']);
    expect(dairy.map((entry) => entry.position)).toEqual([0, 1, 2]);
    expect(insertShoppingListItemAfter([item({ id: 1 })], 7, 99, 3, 'Nope')).toBeNull();
  });
});
