import { describe, expect, it } from 'vitest';

import { planShoppingListReconcile } from '@/lib/shopping-list/shoppingListReconcile';
import type { ShoppingList, ShoppingListItem } from '@/types/shoppingList';

function item(overrides: Partial<ShoppingListItem> & Pick<ShoppingListItem, 'id'>): ShoppingListItem {
  return {
    shopping_list_id: 1,
    name: 'Milk',
    checked: false,
    deleted: false,
    created_by: 1,
    category: 'other',
    position: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function list(items: ShoppingListItem[]): ShoppingList {
  return {
    id: 1,
    family_group_id: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    items,
  };
}

describe('planShoppingListReconcile', () => {
  it('turns ticks, an add, and a remove into one update, one add, and one delete', () => {
    const baseline = list([
      item({ id: 1, name: 'Milk', checked: false, position: 0 }),
      item({ id: 2, name: 'Bread', checked: false, position: 1 }),
      item({ id: 3, name: 'Eggs', checked: false, position: 2 }),
    ]);
    const local = list([
      item({ id: 1, name: 'Milk', checked: true, position: 0 }),
      item({ id: 3, name: 'Eggs', checked: true, position: 1 }),
      item({
        id: 'temp_apples',
        name: 'Apples',
        checked: true,
        category: 'fruit_veg',
        position: 0,
      }),
    ]);

    const plan = planShoppingListReconcile(local, baseline);

    expect(plan.updates).toEqual([
      { id: 1, checked: true },
      { id: 3, checked: true },
    ]);
    expect(plan.adds).toEqual([
      {
        tempId: 'temp_apples',
        name: 'Apples',
        category: 'fruit_veg',
        checked: true,
        position: 0,
      },
    ]);
    expect(plan.deletes).toEqual([2]);
  });

  it('omits a tick that was undone and an item added then removed', () => {
    const baseline = list([item({ id: 1, name: 'Milk', checked: false })]);
    const local = list([item({ id: 1, name: 'Milk', checked: false })]);

    const plan = planShoppingListReconcile(local, baseline);

    expect(plan.adds).toEqual([]);
    expect(plan.updates).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.reorders).toEqual([]);
  });
});
