import { useCallback, useState } from 'react';

import {
  getShoppingListCheckedUpdateIds,
  getShoppingListFamilyIds,
} from '@/lib/shopping-list/shoppingListTree';
import {
  resolveShoppingListErrorMessage,
  useAddShoppingListItem,
  useBulkDeleteShoppingListItems,
  useBulkUpdateShoppingListItems,
  useDeleteShoppingListItem,
} from '@/lib/queries/shoppingList';
import type { ShoppingListItem } from '@/types/shoppingList';

function toPersistableUpdates(
  updates: { id: number | string; name?: string; checked?: boolean }[]
) {
  return updates
    .filter((update): update is { id: number; name?: string; checked?: boolean } =>
      typeof update.id === 'number'
    )
    .map((update) => {
      const payload: { id: number; name?: string; checked?: boolean } = { id: update.id };
      if (update.name !== undefined) {
        payload.name = update.name;
      }
      if (update.checked !== undefined) {
        payload.checked = update.checked;
      }
      return payload;
    });
}

export function useShoppingListEditor() {
  const [newItemName, setNewItemName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const addItemMutation = useAddShoppingListItem();
  const deleteItemMutation = useDeleteShoppingListItem();
  const bulkUpdateMutation = useBulkUpdateShoppingListItems();
  const bulkDeleteMutation = useBulkDeleteShoppingListItems();

  const handleAddNewItem = useCallback(
    async (familyGroupId: number | undefined) => {
      const trimmedName = newItemName.trim();
      if (!familyGroupId || !trimmedName) {
        return false;
      }

      setActionError(null);

      try {
        await addItemMutation.mutateAsync({
          familyGroupId,
          name: trimmedName,
          parentItemId: null,
        });
        setNewItemName('');
        return true;
      } catch (error) {
        setActionError(resolveShoppingListErrorMessage(error));
        return false;
      }
    },
    [addItemMutation, newItemName]
  );

  const handleRemoveItem = useCallback(
    async (familyGroupId: number | undefined, itemId: number | string) => {
      if (!familyGroupId || typeof itemId !== 'number') {
        return;
      }

      setActionError(null);

      try {
        await deleteItemMutation.mutateAsync({ familyGroupId, itemId });
      } catch (error) {
        setActionError(resolveShoppingListErrorMessage(error));
      }
    },
    [deleteItemMutation]
  );

  const handleSetItemChecked = useCallback(
    async (
      familyGroupId: number | undefined,
      items: ShoppingListItem[],
      itemId: number | string,
      checked: boolean
    ) => {
      if (!familyGroupId) {
        return;
      }

      const item = items.find((entry) => entry.id === itemId);
      if (!item) {
        return;
      }

      setActionError(null);

      const idsToUpdate = [
        ...new Set(getShoppingListCheckedUpdateIds(item, items, checked)),
      ];

      const updates = idsToUpdate
        .map((id) => {
          const target = items.find((entry) => entry.id === id);
          if (!target) {
            return null;
          }
          return { id, checked };
        })
        .filter((update): update is { id: number | string; checked: boolean } => update !== null);

      const persistable = toPersistableUpdates(updates);
      if (!persistable.length) {
        return;
      }

      try {
        await bulkUpdateMutation.mutateAsync({ familyGroupId, items: persistable });
      } catch (error) {
        setActionError(resolveShoppingListErrorMessage(error));
      }
    },
    [bulkUpdateMutation]
  );

  const handleUncheckAll = useCallback(
    async (familyGroupId: number | undefined, items: ShoppingListItem[]) => {
      if (!familyGroupId) {
        return;
      }

      const checkedItems = items.filter((item) => item.checked);
      const ids = new Set<number | string>();

      for (const item of checkedItems) {
        for (const familyId of getShoppingListFamilyIds(item, items)) {
          ids.add(familyId);
        }
      }

      const updates = [...ids].map((id) => ({ id, checked: false }));
      const persistable = toPersistableUpdates(updates);
      if (!persistable.length) {
        return;
      }

      setActionError(null);

      try {
        await bulkUpdateMutation.mutateAsync({ familyGroupId, items: persistable });
      } catch (error) {
        setActionError(resolveShoppingListErrorMessage(error));
      }
    },
    [bulkUpdateMutation]
  );

  const handleDeleteAllChecked = useCallback(
    async (familyGroupId: number | undefined, items: ShoppingListItem[]) => {
      if (!familyGroupId) {
        return;
      }

      const checkedItems = items.filter((item) => item.checked);
      const ids = new Set<number | string>();

      for (const item of checkedItems) {
        for (const familyId of getShoppingListFamilyIds(item, items)) {
          ids.add(familyId);
        }
      }

      const persistableIds = [...ids].filter((id): id is number => typeof id === 'number');
      if (!persistableIds.length) {
        return;
      }

      setActionError(null);

      try {
        await bulkDeleteMutation.mutateAsync({ familyGroupId, ids: persistableIds });
      } catch (error) {
        setActionError(resolveShoppingListErrorMessage(error));
      }
    },
    [bulkDeleteMutation]
  );

  return {
    newItemName,
    setNewItemName,
    actionError,
    clearActionError: () => setActionError(null),
    isAdding: addItemMutation.isPending,
    isUpdatingItems: bulkUpdateMutation.isPending,
    isDeletingChecked: bulkDeleteMutation.isPending,
    removingItemId: deleteItemMutation.isPending
      ? (deleteItemMutation.variables?.itemId ?? null)
      : null,
    handleAddNewItem,
    handleRemoveItem,
    handleSetItemChecked,
    handleUncheckAll,
    handleDeleteAllChecked,
  };
}
