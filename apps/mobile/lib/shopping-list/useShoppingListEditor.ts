import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import {
  applyActiveFlatOrderToAllItems,
  getActiveFlatShoppingListItems,
  getShoppingListCheckedUpdateIds,
  getShoppingListFamilyIds,
  indentShoppingListActiveItem,
  insertShoppingListItemAfter,
  isTempShoppingListItemId,
  rebuildItemHierarchyFromFlatOrder,
  toPersistableReorderPayload,
} from '@/lib/shopping-list/shoppingListTree';
import { applyShoppingListDropHierarchy } from '@/lib/shopping-list/shoppingListDrop';
import { isNetworkError } from '@/lib/auth/httpError';
import { isShoppingListOfflineQueuedError } from '@/lib/shopping-list/shoppingListOfflineError';
import { discardPendingOpsForItem } from '@/lib/shopping-list/shoppingListPendingQueue';
import {
  resolveShoppingListErrorMessage,
  setShoppingListQueryData,
  shoppingListKeys,
  useAddShoppingListItem,
  useBulkDeleteShoppingListItems,
  useBulkUpdateShoppingListItems,
  useDeleteShoppingListItem,
  useReorderShoppingListItems,
  useUpdateShoppingListItem,
} from '@/lib/queries/shoppingList';
import type { ShoppingList, ShoppingListItem } from '@/types/shoppingList';

function toPersistableUpdates(
  updates: { id: number | string; name?: string; checked?: boolean }[]
) {
  return updates.map((update) => {
    const payload: { id: number | string; name?: string; checked?: boolean } = {
      id: update.id,
    };
    if (update.name !== undefined) {
      payload.name = update.name;
    }
    if (update.checked !== undefined) {
      payload.checked = update.checked;
    }
    return payload;
  });
}

function isIgnorableShoppingListMutationError(error: unknown): boolean {
  return isShoppingListOfflineQueuedError(error) || isNetworkError(error);
}

export function useShoppingListEditor() {
  const queryClient = useQueryClient();
  const [newItemName, setNewItemName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<number | string | null>(null);
  const addItemMutation = useAddShoppingListItem();
  const updateItemMutation = useUpdateShoppingListItem();
  const deleteItemMutation = useDeleteShoppingListItem();
  const bulkUpdateMutation = useBulkUpdateShoppingListItems();
  const bulkDeleteMutation = useBulkDeleteShoppingListItems();
  const reorderMutation = useReorderShoppingListItems();
  const skipBlurCommitItemIdRef = useRef<number | string | null>(null);
  const committingItemIdsRef = useRef(new Set<string>());

  const getLatestShoppingList = useCallback(
    (familyGroupId: number) =>
      queryClient.getQueryData<ShoppingList>(shoppingListKeys.family(familyGroupId)) ?? null,
    [queryClient]
  );

  const patchShoppingList = useCallback(
    (familyGroupId: number, updater: (shoppingList: ShoppingList) => ShoppingList) => {
      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) => {
        if (!shoppingList) {
          return shoppingList;
        }
        return updater(shoppingList);
      });
    },
    [queryClient]
  );

  const focusItem = useCallback((itemId: number | string | null) => {
    setFocusedItemId(itemId);
  }, []);

  const handleItemNameChange = useCallback(
    (familyGroupId: number | undefined, itemId: number | string, name: string) => {
      if (!familyGroupId) {
        return;
      }

      patchShoppingList(familyGroupId, (shoppingList) => ({
        ...shoppingList,
        items: shoppingList.items.map((item) =>
          item.id === itemId ? { ...item, name } : item
        ),
      }));
    },
    [patchShoppingList]
  );

  const removeLocalItem = useCallback(
    (familyGroupId: number, itemId: number | string) => {
      patchShoppingList(familyGroupId, (shoppingList) => ({
        ...shoppingList,
        items: shoppingList.items.filter((item) => item.id !== itemId),
      }));
      setFocusedItemId((current) => (current === itemId ? null : current));
    },
    [patchShoppingList]
  );

  const commitItemName = useCallback(
    async (
      familyGroupId: number | undefined,
      itemId: number | string,
      name: string
    ): Promise<number | string | null> => {
      if (!familyGroupId) {
        return null;
      }

      const commitKey = String(itemId);
      if (committingItemIdsRef.current.has(commitKey)) {
        return null;
      }

      const shoppingList = getLatestShoppingList(familyGroupId);
      if (!shoppingList) {
        return null;
      }

      const trimmedName = name.trim();
      const item = shoppingList.items.find((entry) => entry.id === itemId);
      if (!item) {
        return null;
      }

      committingItemIdsRef.current.add(commitKey);

      try {
        if (isTempShoppingListItemId(itemId)) {
          if (!trimmedName) {
            removeLocalItem(familyGroupId, itemId);
            return null;
          }

          setActionError(null);

          try {
            const newItem = await addItemMutation.mutateAsync({
              familyGroupId,
              name: trimmedName,
              parentItemId: item.parent_item_id,
              replaceTempId: itemId,
            });
            return newItem.id;
          } catch (error) {
            if (isIgnorableShoppingListMutationError(error)) {
              return itemId;
            }
            setActionError(resolveShoppingListErrorMessage(error));
            return null;
          }
        }

        if (trimmedName === item.name.trim()) {
          return itemId;
        }

        if (!trimmedName) {
          return itemId;
        }

        setActionError(null);

        try {
          const updatedItem = await updateItemMutation.mutateAsync({
            familyGroupId,
            itemId,
            updates: { name: trimmedName },
          });
          return updatedItem.id;
        } catch (error) {
          if (isIgnorableShoppingListMutationError(error)) {
            return itemId;
          }
          setActionError(resolveShoppingListErrorMessage(error));
          return null;
        }
      } finally {
        committingItemIdsRef.current.delete(commitKey);
      }
    },
    [addItemMutation, getLatestShoppingList, removeLocalItem, updateItemMutation]
  );

  const insertItemBelow = useCallback(
    (
      familyGroupId: number,
      shoppingList: ShoppingList,
      existingItemId: number | string,
      createdBy: number
    ): number | string | null => {
      const result = insertShoppingListItemAfter(
        shoppingList.items,
        shoppingList.id,
        existingItemId,
        createdBy
      );

      if (!result) {
        return null;
      }

      patchShoppingList(familyGroupId, (current) => ({
        ...current,
        items: result.items,
      }));

      return result.tempItem.id;
    },
    [patchShoppingList]
  );

  const applyActiveFlatOrder = useCallback(
    async (familyGroupId: number | undefined, flatActiveItems: ShoppingListItem[]) => {
      if (!familyGroupId) {
        return;
      }

      const shoppingList = getLatestShoppingList(familyGroupId);
      if (!shoppingList) {
        return;
      }

      const nextItems = applyActiveFlatOrderToAllItems(shoppingList.items, flatActiveItems);
      const persistable = toPersistableReorderPayload(
        rebuildItemHierarchyFromFlatOrder(flatActiveItems)
      );

      setActionError(null);

      try {
        if (persistable.length > 0) {
          await reorderMutation.mutateAsync({
            familyGroupId,
            items: persistable,
            nextItems,
          });
          return;
        }

        patchShoppingList(familyGroupId, (current) => ({
          ...current,
          items: nextItems,
        }));
      } catch (error) {
        if (isIgnorableShoppingListMutationError(error)) {
          return;
        }
        setActionError(resolveShoppingListErrorMessage(error));
      }
    },
    [getLatestShoppingList, patchShoppingList, reorderMutation]
  );

  const handleIndentItem = useCallback(
    async (familyGroupId: number | undefined, items: ShoppingListItem[], itemId: number | string) => {
      if (!familyGroupId) {
        return;
      }

      const activeItems = getActiveFlatShoppingListItems(items);
      const updatedItems = indentShoppingListActiveItem(activeItems, itemId);
      if (!updatedItems) {
        return;
      }

      await applyActiveFlatOrder(familyGroupId, updatedItems);
    },
    [applyActiveFlatOrder]
  );

  const handleOutdentItem = useCallback(
    async (familyGroupId: number | undefined, items: ShoppingListItem[], itemId: number | string) => {
      if (!familyGroupId) {
        return;
      }

      const shoppingList = getLatestShoppingList(familyGroupId);
      if (!shoppingList) {
        return;
      }

      const activeItems = getActiveFlatShoppingListItems(items);
      const target = activeItems.find((item) => item.id === itemId);
      if (!target || target.parent_item_id === null) {
        return;
      }

      const parent = shoppingList.items.find((item) => item.id === target.parent_item_id);
      const updatedItems = activeItems.map((item) =>
        item.id === itemId
          ? { ...item, parent_item_id: parent?.parent_item_id ?? null }
          : item
      );

      await applyActiveFlatOrder(familyGroupId, updatedItems);
    },
    [applyActiveFlatOrder, getLatestShoppingList]
  );

  const handleDragReorder = useCallback(
    async (
      familyGroupId: number | undefined,
      allItems: ShoppingListItem[],
      params: {
        reorderedItems: ShoppingListItem[];
        draggedIds: Set<number | string>;
        hoveredItem: ShoppingListItem | null;
        nestAsChild: boolean;
      }
    ) => {
      if (!familyGroupId) {
        return;
      }

      const updatedItems = applyShoppingListDropHierarchy(
        params.reorderedItems,
        params.draggedIds,
        params.hoveredItem,
        params.nestAsChild,
        allItems
      );

      await applyActiveFlatOrder(familyGroupId, updatedItems);
    },
    [applyActiveFlatOrder]
  );

  const handleItemBlur = useCallback(
    async (
      familyGroupId: number | undefined,
      itemId: number | string,
      name: string
    ) => {
      if (skipBlurCommitItemIdRef.current === itemId) {
        skipBlurCommitItemIdRef.current = null;
        return;
      }

      await commitItemName(familyGroupId, itemId, name);
      setFocusedItemId((current) => (current === itemId ? null : current));
    },
    [commitItemName]
  );

  const handleItemSubmitEditing = useCallback(
    async (
      familyGroupId: number | undefined,
      itemId: number | string,
      name: string,
      createdBy: number
    ) => {
      if (!familyGroupId) {
        return;
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        if (isTempShoppingListItemId(itemId)) {
          removeLocalItem(familyGroupId, itemId);
        }
        return;
      }

      skipBlurCommitItemIdRef.current = itemId;

      const resolvedId = await commitItemName(familyGroupId, itemId, name);
      if (!resolvedId) {
        skipBlurCommitItemIdRef.current = null;
        return;
      }

      const latestList = getLatestShoppingList(familyGroupId);
      if (!latestList) {
        skipBlurCommitItemIdRef.current = null;
        return;
      }

      const nextTempId = insertItemBelow(familyGroupId, latestList, resolvedId, createdBy);
      if (nextTempId) {
        focusItem(nextTempId);
      }
    },
    [commitItemName, focusItem, getLatestShoppingList, insertItemBelow, removeLocalItem]
  );

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
        if (isIgnorableShoppingListMutationError(error)) {
          setNewItemName('');
          return true;
        }
        setActionError(resolveShoppingListErrorMessage(error));
        return false;
      }
    },
    [addItemMutation, newItemName]
  );

  const handleRemoveItem = useCallback(
    async (familyGroupId: number | undefined, itemId: number | string) => {
      if (!familyGroupId) {
        return;
      }

      if (isTempShoppingListItemId(itemId)) {
        removeLocalItem(familyGroupId, itemId);
        void discardPendingOpsForItem(familyGroupId, itemId);
        return;
      }

      setActionError(null);

      try {
        await deleteItemMutation.mutateAsync({ familyGroupId, itemId });
      } catch (error) {
        if (isIgnorableShoppingListMutationError(error)) {
          return;
        }
        setActionError(resolveShoppingListErrorMessage(error));
      }
    },
    [deleteItemMutation, removeLocalItem]
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
        if (isIgnorableShoppingListMutationError(error)) {
          return;
        }
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
        if (isIgnorableShoppingListMutationError(error)) {
          return;
        }
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

      const persistableIds = [...ids];
      if (!persistableIds.length) {
        return;
      }

      setActionError(null);

      try {
        await bulkDeleteMutation.mutateAsync({ familyGroupId, ids: persistableIds });
      } catch (error) {
        if (isIgnorableShoppingListMutationError(error)) {
          return;
        }
        setActionError(resolveShoppingListErrorMessage(error));
      }
    },
    [bulkDeleteMutation]
  );

  return {
    newItemName,
    setNewItemName,
    focusedItemId,
    focusItem,
    actionError,
    clearActionError: () => setActionError(null),
    isAdding: addItemMutation.isPending,
    isUpdatingItems: bulkUpdateMutation.isPending || updateItemMutation.isPending,
    isPersistingItem: addItemMutation.isPending || updateItemMutation.isPending,
    isReordering: reorderMutation.isPending,
    isDeletingChecked: bulkDeleteMutation.isPending,
    removingItemId: deleteItemMutation.isPending
      ? (deleteItemMutation.variables?.itemId ?? null)
      : null,
    handleItemNameChange,
    handleItemBlur,
    handleItemSubmitEditing,
    handleIndentItem,
    handleOutdentItem,
    handleDragReorder,
    handleAddNewItem,
    handleRemoveItem,
    handleSetItemChecked,
    handleUncheckAll,
    handleDeleteAllChecked,
  };
}
