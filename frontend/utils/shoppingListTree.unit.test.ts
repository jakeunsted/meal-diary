import { describe, expect, it } from 'vitest';
import type { ShoppingListItem } from '~/types/ShoppingList';
import {
  flattenShoppingListItems,
  insertShoppingListItemAfter,
  rebuildItemOrderFromFlatItems,
} from './shoppingListTree';

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
  it('flattens items by category then position', () => {
    const flat = flattenShoppingListItems([
      item({ id: 2, name: 'Bread', category: 'bakery', position: 0 }),
      item({ id: 1, name: 'Chicken', category: 'meat', position: 1 }),
      item({ id: 3, name: 'Beef', category: 'meat', position: 0 }),
    ]);

    expect(flat.map((entry) => entry.id)).toEqual([3, 1, 2]);
  });

  it('rebuilds a reorder payload from a flat list', () => {
    const changes = rebuildItemOrderFromFlatItems([
      item({ id: 3, category: 'meat', position: 5 }),
      item({ id: 1, category: 'meat', position: 9 }),
    ]);

    expect(changes).toEqual([
      { id: 3, category: 'meat', position: 0 },
      { id: 1, category: 'meat', position: 1 },
    ]);
  });

  it('inserts after an item and reindexes that category', () => {
    const next = insertShoppingListItemAfter(
      [
        item({ id: 1, category: 'dairy', position: 0 }),
        item({ id: 2, category: 'dairy', position: 1 }),
      ],
      1,
      item({ id: 3, name: 'Yogurt', category: 'other', position: 0 })
    );

    const dairy = next
      .filter((entry) => entry.category === 'dairy')
      .sort((a, b) => a.position - b.position);
    expect(dairy.map((entry) => entry.id)).toEqual([1, 3, 2]);
    expect(dairy.map((entry) => entry.position)).toEqual([0, 1, 2]);
  });

  it('appends into other when the anchor is missing or the category is unknown', () => {
    const next = insertShoppingListItemAfter(
      [item({ id: 1, category: 'other', position: 0 })],
      99,
      item({ id: 4, name: 'Mystery', category: 'not-a-category', position: 8 })
    );

    expect(next.find((entry) => entry.id === 4)).toMatchObject({
      category: 'other',
      position: 1,
    });
  });
});
