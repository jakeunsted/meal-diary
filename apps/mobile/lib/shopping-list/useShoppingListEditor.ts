import {
  applyCategoryFlatOrder,
  buildShoppingListReorderPayload,
  categorizeShoppingItemName,
  moveShoppingListItemToCategory,
  type ShoppingCategory,
} from '@meal-diary/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { isNetworkError } from '@/lib/auth/httpError';
import { isShoppingListOfflineQueuedError } from '@/lib/shopping-list/shoppingListOfflineError';
import { discardPendingOpsForItem } from '@/lib/shopping-list/shoppingListPendingQueue';
import {
  insertShoppingListItemAfter,
  isTempShoppingListItemId,
  resolveShoppingListItemCategory,
  toPersistableReorderPayload,
} from '@/lib/shopping-list/shoppingListTree';
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
  updates: {
    id: number | string;
    name?: string;
    checked?: boolean;
    category?: ShoppingCategory;
  }[]
) {
  return updates.map((update) => {
    const payload: {
      id: number | string;
      name?: string;
      checked?: boolean;
      category?: ShoppingCategory;
    } = {
      id: update.id,
    };
    if (update.name !== undefined) {
      payload.name = update.name;
    }
    if (update.checked !== undefined) {
      payload.checked = update.checked;
    }
    if (update.category !== undefined) {
      payload.category = resolveShoppingListItemCategory(update.category);
    }
    return payload;
  });
}

function isIgnorableShoppingListMutationError(error: unknown): boolean {
  return isShoppingListOfflineQueuedError(error) || isNetworkError(error);
}

function asCategorizedItems(items: ShoppingListItem[]) {
  return items.map((item) => ({
    ...item,
    category: resolveShoppingListItemCategory(item.category),
  }));
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
              category: resolveShoppingListItemCategory(item.category),
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

  const persistReorder = useCallback(
    async (familyGroupId: number, nextItems: ShoppingListItem[]) => {
      const persistable = toPersistableReorderPayload(
        buildShoppingListReorderPayload(asCategorizedItems(nextItems))
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
    [patchShoppingList, reorderMutation]
  );

  const handleMoveToCategory = useCallback(
    async (
      familyGroupId: number | undefined,
      itemId: number | string,
      category: ShoppingCategory
    ) => {
      if (!familyGroupId) {
        return;
      }

      const shoppingList = getLatestShoppingList(familyGroupId);
      if (!shoppingList) {
        return;
      }

      const nextItems = moveShoppingListItemToCategory(
        asCategorizedItems(shoppingList.items),
        itemId,
        category
      );

      await persistReorder(familyGroupId, nextItems);
    },
    [getLatestShoppingList, persistReorder]
  );

  const handleReorderWithinCategory = useCallback(
    async (
      familyGroupId: number | undefined,
      category: ShoppingCategory,
      orderedIds: Array<number | string>
    ) => {
      if (!familyGroupId) {
        return;
      }

      const shoppingList = getLatestShoppingList(familyGroupId);
      if (!shoppingList) {
        return;
      }

      const nextItems = applyCategoryFlatOrder(
        asCategorizedItems(shoppingList.items),
        category,
        orderedIds
      );

      await persistReorder(familyGroupId, nextItems);
    },
    [getLatestShoppingList, persistReorder]
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
    async (familyGroupId: number | undefined, category?: ShoppingCategory) => {
      const trimmedName = newItemName.trim();
      if (!familyGroupId || !trimmedName) {
        return false;
      }

      setActionError(null);

      const resolvedCategory = category ?? categorizeShoppingItemName(trimmedName);

      try {
        await addItemMutation.mutateAsync({
          familyGroupId,
          name: trimmedName,
          category: resolvedCategory,
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

      const persistable = toPersistableUpdates([{ id: itemId, checked }]);
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

      const updates = items
        .filter((item) => item.checked)
        .map((item) => ({ id: item.id, checked: false }));
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

      const persistableIds = items.filter((item) => item.checked).map((item) => item.id);
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
    handleMoveToCategory,
    handleReorderWithinCategory,
    handleAddNewItem,
    handleRemoveItem,
    handleSetItemChecked,
    handleUncheckAll,
    handleDeleteAllChecked,
  };
}
