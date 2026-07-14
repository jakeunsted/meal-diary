import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import {
  ShoppingListOfflineQueuedError,
  shouldRollbackShoppingListOptimistic,
} from '@/lib/shopping-list/shoppingListOfflineError';
import { remapTempIdsInOps } from '@/lib/shopping-list/shoppingListPendingQueue';
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
          { id: 'temp_abc', parent_item_id: null, position: 0 },
          { id: 9, parent_item_id: 'temp_abc', position: 1 },
        ],
      },
      {
        opId: '4',
        type: 'add',
        familyGroupId: 1,
        tempId: 'temp_child',
        name: 'Eggs',
        parentItemId: 'temp_abc',
      },
    ];

    const remapped = remapTempIdsInOps(ops, 'temp_abc', 42);

    expect(remapped[0]).toMatchObject({ type: 'update', itemId: 42 });
    expect(remapped[1]).toMatchObject({ type: 'bulkDelete', ids: [42, 9] });
    expect(remapped[2]).toMatchObject({
      type: 'reorder',
      items: [
        { id: 42, parent_item_id: null, position: 0 },
        { id: 9, parent_item_id: 42, position: 1 },
      ],
    });
    expect(remapped[3]).toMatchObject({
      type: 'add',
      tempId: 'temp_child',
      parentItemId: 42,
    });
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
