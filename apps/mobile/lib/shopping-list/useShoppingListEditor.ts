import { useCallback, useState } from 'react';

import {
  resolveShoppingListErrorMessage,
  useAddShoppingListItem,
  useDeleteShoppingListItem,
} from '@/lib/queries/shoppingList';

export function useShoppingListEditor() {
  const [newItemName, setNewItemName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const addItemMutation = useAddShoppingListItem();
  const deleteItemMutation = useDeleteShoppingListItem();

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

  return {
    newItemName,
    setNewItemName,
    actionError,
    clearActionError: () => setActionError(null),
    isAdding: addItemMutation.isPending,
    removingItemId: deleteItemMutation.isPending
      ? (deleteItemMutation.variables?.itemId ?? null)
      : null,
    handleAddNewItem,
    handleRemoveItem,
  };
}
