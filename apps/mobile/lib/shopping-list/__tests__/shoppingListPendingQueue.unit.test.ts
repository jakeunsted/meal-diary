import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import {
  ShoppingListOfflineQueuedError,
  shouldRollbackShoppingListOptimistic,
} from '@/lib/shopping-list/shoppingListOfflineError';
import {
  remapTempIdsInOps,
  sanitizePendingOpsForCategories,
} from '@/lib/shopping-list/shoppingListPendingQueue';
import type { ShoppingListPendingOp } from '@/types/shoppingList';

describe('remapTempIdsInOps', () => {
  it('rewrites temp ids across dependent ops after a successful add', () => {
    const ops: ShoppingListPendingOp[] = [
      {
        opId: '1',
        type: 'update',
        familyGroupId: 1,
        itemId: 'temp_abc',
        updates: { checked: true },
      },
      {
        opId: '2',
        type: 'bulkDelete',
        familyGroupId: 1,
        ids: ['temp_abc', 9],
      },
      {
        opId: '3',
        type: 'reorder',
        familyGroupId: 1,
        items: [
          { id: 'temp_abc', category: 'meat', position: 0 },
          { id: 9, category: 'meat', position: 1 },
        ],
      },
      {
        opId: '4',
        type: 'add',
        familyGroupId: 1,
        tempId: 'temp_child',
        name: 'Eggs',
        category: 'other',
      },
    ];

    const remapped = remapTempIdsInOps(ops, 'temp_abc', 42);

    expect(remapped[0]).toMatchObject({ type: 'update', itemId: 42 });
    expect(remapped[1]).toMatchObject({ type: 'bulkDelete', ids: [42, 9] });
    expect(remapped[2]).toMatchObject({
      type: 'reorder',
      items: [
        { id: 42, category: 'meat', position: 0 },
        { id: 9, category: 'meat', position: 1 },
      ],
    });
    expect(remapped[3]).toMatchObject({
      type: 'add',
      tempId: 'temp_child',
      category: 'other',
    });
  });
});

describe('sanitizePendingOpsForCategories', () => {
  it('drops legacy reorder ops that still use parent_item_id', () => {
    const ops = [
      {
        opId: '1',
        type: 'reorder',
        familyGroupId: 1,
        items: [{ id: 1, parent_item_id: null, position: 0 }],
      },
      {
        opId: '2',
        type: 'reorder',
        familyGroupId: 1,
        items: [{ id: 2, category: 'bakery', position: 0 }],
      },
    ] as ShoppingListPendingOp[];

    const sanitized = sanitizePendingOpsForCategories(ops);

    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]).toMatchObject({ opId: '2', type: 'reorder' });
  });

  it('adds category to legacy add ops from the item name', () => {
    const ops = [
      {
        opId: '1',
        type: 'add',
        familyGroupId: 1,
        tempId: 'temp_1',
        name: 'chicken breast',
        parentItemId: null,
      },
    ] as unknown as ShoppingListPendingOp[];

    const sanitized = sanitizePendingOpsForCategories(ops);

    expect(sanitized[0]).toMatchObject({
      type: 'add',
      name: 'chicken breast',
      category: 'meat',
    });
    expect(sanitized[0]).not.toHaveProperty('parentItemId');
  });
});

describe('shouldRollbackShoppingListOptimistic', () => {
  it('keeps optimistic state for offline-queued and network errors', () => {
    expect(shouldRollbackShoppingListOptimistic(new ShoppingListOfflineQueuedError())).toBe(
      false
    );
    expect(shouldRollbackShoppingListOptimistic(new Error('Network request failed'))).toBe(
      false
    );
  });

  it('rolls back for real server errors', () => {
    expect(
      shouldRollbackShoppingListOptimistic(new ApiError(400, 'Name is required'))
    ).toBe(true);
  });
});
