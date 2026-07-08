import { defineStore } from 'pinia';
import { Preferences } from '@capacitor/preferences';
import type {
  ShoppingList,
  ShoppingListItem,
  ShoppingListState,
} from '~/types/ShoppingList';
import { useApi } from '~/composables/useApi';
import { useConnection } from '~/composables/useConnection';
import {
  flattenShoppingListItems,
  getShoppingListCheckedUpdateIds,
  getShoppingListFamilyIds,
  isShoppingListDescendant,
  rebuildItemHierarchyFromFlatOrder,
  indentShoppingListActiveItem,
} from '~/utils/shoppingListTree';

// Temporary ID prefix for offline items
const TEMP_ID_PREFIX = 'temp_';

const emptyPendingChanges = (): ShoppingListState['pendingChanges'] => ({
  add: [],
  update: [],
  delete: [],
  reorder: [],
});

/**
 * Some Nuxt handlers return `{ data }` from `authenticatedFetch`; others return the payload only.
 */
function unwrapShoppingResponse<T>(response: unknown): T {
  if (response !== null && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data;
  }
  return response as T;
}

let saveToLocalStorageTimer: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DEBOUNCE_MS = 400;

/**
 * Store for managing shopping list data and operations
 */
export const useShoppingListStore = defineStore('shoppingList', {
  state: (): ShoppingListState => ({
    shoppingList: null,
    isLoading: false,
    error: null,
    pendingChanges: emptyPendingChanges(),
  }),

  getters: {
    /**
     * Check if an ID is temporary
     */
    isTempId: () => (id: number | string) => {
      return typeof id === 'string' && id.startsWith(TEMP_ID_PREFIX);
    }
  },

  actions: {
    /**
     * Generate a temporary ID for offline items
     */
    generateTempId() {
      return `${TEMP_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    },

    /**
     * Save the current state to local storage
     */
    async saveToLocalStorage() {
      if (import.meta.client) {
        await Preferences.set({
          key: 'shoppingList',
          value: JSON.stringify({
            shoppingList: this.shoppingList,
            pendingChanges: this.pendingChanges
          })
        });
      }
    },

    /**
     * Debounce rapid Preferences writes (typing, reorder tweaks).
     */
    scheduleSaveToLocalStorage() {
      if (!import.meta.client) {
        return;
      }
      if (saveToLocalStorageTimer !== null) {
        clearTimeout(saveToLocalStorageTimer);
      }
      saveToLocalStorageTimer = setTimeout(() => {
        saveToLocalStorageTimer = null;
        void this.saveToLocalStorage();
      }, PERSIST_DEBOUNCE_MS);
    },

    /**
     * Load shopping list data from local storage
     * @returns {Promise<boolean>} True if data was loaded successfully, false otherwise
     */
    async loadFromLocalStorage() {
      if (import.meta.client) {
        const { value } = await Preferences.get({ key: 'shoppingList' });
        if (value) {
          try {
            const data = JSON.parse(value);
            this.shoppingList = data.shoppingList;
            const p = data.pendingChanges;
            this.pendingChanges = {
              add: Array.isArray(p?.add) ? p.add : [],
              update: Array.isArray(p?.update) ? p.update : [],
              delete: Array.isArray(p?.delete) ? p.delete : [],
              reorder: Array.isArray(p?.reorder) ? p.reorder : [],
            };
            return true;
          } catch (error) {
            console.error('Failed to parse stored shopping list:', error);
            await Preferences.remove({ key: 'shoppingList' });
          }
        }
      }
      return false;
    },

    /**
     * Queue a temp row for sync if it is not already in pending adds (e.g. after a failed POST).
     */
    enqueueTempAddIfNotQueued(itemId: number | string) {
      if (!this.isTempId(itemId) || !this.shoppingList) {
        return;
      }
      const item = this.shoppingList.items.find(i => String(i.id) === String(itemId));
      if (!item) {
        return;
      }
      const already = this.pendingChanges.add.some(i => String(i.id) === String(itemId));
      if (!already) {
        this.pendingChanges.add.push(item);
      }
      this.scheduleSaveToLocalStorage();
    },

    /**
     * Fetch the shopping list for a family group
     * @param forceRefresh - Whether to force a refresh from the server
     */
    async fetchShoppingList(forceRefresh = false) {
      const userStore = useUserStore();
      const authStore = useAuthStore();

      if (!authStore.user?.family_group_id) {
        return;
      }

      let loadingStarted = false;
      try {
        if (!this.shoppingList || forceRefresh) {
          loadingStarted = true;
          this.isLoading = true;
          this.error = null;
          let familyGroupId = userStore.user?.family_group_id || authStore.user?.family_group_id;
          if (!familyGroupId) {
            const updatedUser = await userStore.fetchUser(true);
            if (updatedUser?.family_group_id) {
              familyGroupId = updatedUser.family_group_id;
              // Update auth store with refreshed user data
              if (authStore.accessToken && authStore.refreshToken) {
                await authStore.setAuth({
                  user: updatedUser,
                  accessToken: authStore.accessToken,
                  refreshToken: authStore.refreshToken
                });
              }
            } else {
              // Don't throw error, just return silently if no family group
              this.isLoading = false;
              return;
            }
          }
          console.log('fetching shopping list for family group:', familyGroupId);
          const { api } = useApi();
          const response = await api(`/api/shopping-list/${familyGroupId}`);
          const shoppingList = unwrapShoppingResponse<ShoppingList>(response);
          this.shoppingList = shoppingList;
          await this.saveToLocalStorage();
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch shopping list';
        const loadedFromStorage = await this.loadFromLocalStorage();
        if (!loadedFromStorage) {
          throw err;
        }
      } finally {
        if (loadingStarted) {
          this.isLoading = false;
        }
      }
    },

    /**
     * Add a new item to the shopping list (offline-first)
     * @param item - The item data to add
     */
    async addItem(item: { name: string; parentItemId?: number | null }) {
      const userStore = useUserStore();
      const tempId = this.generateTempId();
      const createdById = userStore.user?.id || 0;
      const resolvedParentId = item.parentItemId ?? null;

      const existingItems = this.shoppingList?.items || [];
      const siblingPositions = existingItems
        .filter(existing => existing.parent_item_id === resolvedParentId)
        .map(existing => existing.position);
      const nextPosition = siblingPositions.length ? Math.max(...siblingPositions) + 1 : 0;

      // Create a temporary item
      const tempItem: ShoppingListItem = {
        id: tempId,
        shopping_list_id: this.shoppingList?.id || 0,
        name: item.name,
        checked: false,
        deleted: false,
        parent_item_id: resolvedParentId,
        position: nextPosition,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: createdById
      };

      // Add to local state immediately
      if (this.shoppingList) {
        if (!Array.isArray(this.shoppingList.items)) {
          this.shoppingList.items = [];
        }
        this.shoppingList.items.push(tempItem);
        this.scheduleSaveToLocalStorage();
      }

      // Add to pending changes
      this.pendingChanges.add.push(tempItem);

      // Try to sync with server
      try {
        const { api } = useApi();
        const response = await api(`/api/shopping-list/${userStore.user?.family_group_id}/items`, {
          method: 'POST',
          body: {
            name: item.name,
            parent_item_id: resolvedParentId
          },
        });

        const newItem = unwrapShoppingResponse<ShoppingListItem>(response);

        // Update the item in the list with the real ID
        if (this.shoppingList) {
          const index = this.shoppingList.items.findIndex(i => String(i.id) === tempId);
          if (index !== -1) {
            this.shoppingList.items[index] = newItem;
            // Remove from pending changes
            this.pendingChanges.add = this.pendingChanges.add.filter(i => String(i.id) !== tempId);
            await this.saveToLocalStorage();
          }
        }
        this.error = null;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to sync new item';
        console.error('Failed to sync item with server:', err);
      }
    },

    async updateItem(itemId: number | string, updates: Partial<ShoppingListItem>) {
      const userStore = useUserStore();
      const isTemp = this.isTempId(itemId);

      // Update local state immediately
      if (this.shoppingList) {
        const index = this.shoppingList.items.findIndex(item => item.id === itemId);
        if (index !== -1) {
          this.shoppingList.items[index] = { ...this.shoppingList.items[index], ...updates };
          const fresh = this.shoppingList.items[index];
          const pendingAddIdx = this.pendingChanges.add.findIndex(i => String(i.id) === String(itemId));
          if (pendingAddIdx !== -1 && fresh) {
            this.pendingChanges.add[pendingAddIdx] = fresh;
          }
        }
        this.scheduleSaveToLocalStorage();
      }

      // If it's a temporary item, no need to sync with server
      if (isTemp) {
        if (updates.name && typeof updates.name === 'string' && updates.name.trim()) {
          await this.persistTempItem(itemId, updates.name);
        }
        return;
      }

      // Add to pending changes (dedupe by id)
      const updatedItem = this.shoppingList?.items.find(i => i.id === itemId);
      if (updatedItem) {
        const existingIdx = this.pendingChanges.update.findIndex(i => i.id === itemId);
        if (existingIdx !== -1) {
          this.pendingChanges.update[existingIdx] = updatedItem;
        } else {
          this.pendingChanges.update.push(updatedItem);
        }
      }

      // Try to sync with server
      try {
        const { api } = useApi();
        const response = await api(`/api/shopping-list/${userStore.user?.family_group_id}/items/${itemId}`, {
          method: 'PUT',
          body: updates,
        });
        const serverUpdatedItem = unwrapShoppingResponse<ShoppingListItem>(response);

        // Update the item in the category with the server response
        if (this.shoppingList) {
          const index = this.shoppingList.items.findIndex(item => item.id === itemId);
          if (index !== -1) {
            this.shoppingList.items[index] = serverUpdatedItem;
          }
          // Remove from pending changes
          this.pendingChanges.update = this.pendingChanges.update.filter(i => i.id !== itemId);
          await this.saveToLocalStorage();
        }

        this.error = null;
        return serverUpdatedItem;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to sync item update';
        console.error('Failed to sync item update with server:', err);
      }
    },

    /**
     * Apply a batch of item updates (name/checked) optimistically, persisting
     * non-temporary items via a single bulk-update request. Temp items are kept
     * fresh locally; persistable updates are queued for offline retry.
     */
    async applyBulkItemUpdates(
      updates: { id: number | string; name?: string; checked?: boolean }[]
    ) {
      if (!this.shoppingList || !updates.length) {
        return;
      }

      const userStore = useUserStore();

      // Optimistic local update
      for (const update of updates) {
        const index = this.shoppingList.items.findIndex(i => i.id === update.id);
        if (index === -1) {
          continue;
        }
        const merged = { ...this.shoppingList.items[index] };
        if (update.name !== undefined) {
          merged.name = update.name;
        }
        if (update.checked !== undefined) {
          merged.checked = update.checked;
        }
        this.shoppingList.items[index] = merged;

        // Keep the pending add entry fresh for not-yet-persisted temp items
        const pendingAddIdx = this.pendingChanges.add.findIndex(i => String(i.id) === String(update.id));
        if (pendingAddIdx !== -1) {
          this.pendingChanges.add[pendingAddIdx] = merged;
        }
      }
      this.scheduleSaveToLocalStorage();

      // Only non-temp items can be persisted to the server by id
      const persistable = updates.filter(u => !this.isTempId(u.id));

      // Queue updates for offline retry (dedupe by id)
      for (const update of persistable) {
        const item = this.shoppingList.items.find(i => i.id === update.id);
        if (!item) {
          continue;
        }
        const existingIdx = this.pendingChanges.update.findIndex(i => i.id === update.id);
        if (existingIdx !== -1) {
          this.pendingChanges.update[existingIdx] = item;
        } else {
          this.pendingChanges.update.push(item);
        }
      }

      if (!persistable.length) {
        await this.saveToLocalStorage();
        return;
      }

      try {
        const { api } = useApi();
        const response = await api(`/api/shopping-list/${userStore.user?.family_group_id}/items/bulk-update`, {
          method: 'PUT',
          body: {
            items: persistable.map((u) => {
              const payload: { id: number; name?: string; checked?: boolean } = { id: u.id as number };
              if (u.name !== undefined) {
                payload.name = u.name;
              }
              if (u.checked !== undefined) {
                payload.checked = u.checked;
              }
              return payload;
            }),
          },
        });

        const serverItems = unwrapShoppingResponse<ShoppingListItem[]>(response);
        if (this.shoppingList && Array.isArray(serverItems)) {
          for (const serverItem of serverItems) {
            const index = this.shoppingList.items.findIndex(i => i.id === serverItem.id);
            if (index !== -1) {
              this.shoppingList.items[index] = serverItem;
            }
          }
        }

        const persistedIds = new Set(persistable.map(u => u.id));
        this.pendingChanges.update = this.pendingChanges.update.filter(i => !persistedIds.has(i.id));
        await this.saveToLocalStorage();
        this.error = null;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to sync item updates';
        console.error('Failed to bulk update items:', err);
      }
    },

    /**
     * Remove a batch of items optimistically, persisting non-temporary items via
     * a single bulk-delete request. Temp items are dropped from pending adds.
     */
    async applyBulkDelete(ids: Array<number | string>) {
      if (!this.shoppingList || !ids.length) {
        return;
      }

      const userStore = useUserStore();
      const idSet = new Set(ids.map(String));

      // Optimistic local removal
      this.shoppingList.items = this.shoppingList.items.filter(i => !idSet.has(String(i.id)));
      this.scheduleSaveToLocalStorage();

      // Temp items only need to be dropped from pending adds
      const tempIds = ids.filter(id => this.isTempId(id));
      if (tempIds.length) {
        const tempSet = new Set(tempIds.map(String));
        this.pendingChanges.add = this.pendingChanges.add.filter(i => !tempSet.has(String(i.id)));
      }

      const persistableIds = ids.filter(id => !this.isTempId(id)) as number[];

      // Queue deletes for offline retry
      for (const id of persistableIds) {
        if (!this.pendingChanges.delete.includes(id)) {
          this.pendingChanges.delete.push(id);
        }
      }

      if (!persistableIds.length) {
        await this.saveToLocalStorage();
        return;
      }

      try {
        const { api } = useApi();
        await api(`/api/shopping-list/${userStore.user?.family_group_id}/items/bulk-delete`, {
          method: 'POST',
          body: { ids: persistableIds },
        });

        const deletedSet = new Set(persistableIds);
        this.pendingChanges.delete = this.pendingChanges.delete.filter(id => !deletedSet.has(id as number));
        await this.saveToLocalStorage();
        this.error = null;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to sync deletes';
        console.error('Failed to bulk delete items:', err);
      }
    },

    /**
     * Restore previously removed items from a snapshot (used by Undo). Non-temp
     * items are un-soft-deleted on the server via the bulk-update endpoint; temp
     * items are re-queued as pending adds.
     */
    async restoreItems(items: ShoppingListItem[]) {
      if (!this.shoppingList || !items.length) {
        return;
      }

      const userStore = useUserStore();

      // Re-insert into local state, clearing the deleted flag
      for (const snapshot of items) {
        const index = this.shoppingList.items.findIndex(i => String(i.id) === String(snapshot.id));
        if (index === -1) {
          this.shoppingList.items.push({ ...snapshot, deleted: false });
        } else {
          this.shoppingList.items[index] = {
            ...this.shoppingList.items[index],
            ...snapshot,
            deleted: false,
          };
        }
      }
      this.scheduleSaveToLocalStorage();

      // Stop any queued deletes for restored items
      const restoreIdSet = new Set(items.map(i => String(i.id)));
      this.pendingChanges.delete = this.pendingChanges.delete.filter(id => !restoreIdSet.has(String(id)));

      const tempItems = items.filter(i => this.isTempId(i.id));
      for (const temp of tempItems) {
        const already = this.pendingChanges.add.some(i => String(i.id) === String(temp.id));
        if (!already) {
          this.pendingChanges.add.push({ ...temp, deleted: false });
        }
      }

      const persistable = items.filter(i => !this.isTempId(i.id));
      if (!persistable.length) {
        await this.saveToLocalStorage();
        return;
      }

      try {
        const { api } = useApi();
        const response = await api(`/api/shopping-list/${userStore.user?.family_group_id}/items/bulk-update`, {
          method: 'PUT',
          body: {
            items: persistable.map(i => ({ id: i.id as number, deleted: false })),
          },
        });

        const serverItems = unwrapShoppingResponse<ShoppingListItem[]>(response);
        if (this.shoppingList && Array.isArray(serverItems)) {
          for (const serverItem of serverItems) {
            const index = this.shoppingList.items.findIndex(i => i.id === serverItem.id);
            if (index !== -1) {
              this.shoppingList.items[index] = serverItem;
            }
          }
        }
        await this.saveToLocalStorage();
        this.error = null;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to restore items';
        console.error('Failed to restore items:', err);
      }
    },

    async setItemChecked(itemId: number | string, checked: boolean, name?: string) {
      if (!this.shoppingList) {
        return;
      }

      const item = this.shoppingList.items.find((entry) => entry.id === itemId);
      if (!item) {
        return;
      }

      const idsToUpdate = [...new Set(getShoppingListCheckedUpdateIds(item, this.shoppingList.items, checked))];

      const updates = idsToUpdate
        .map((id) => {
          const target = this.shoppingList?.items.find((entry) => entry.id === id);
          if (!target) {
            return null;
          }
          const update: { id: number | string; name?: string; checked: boolean } = { id, checked };
          if (id === itemId && name !== undefined) {
            update.name = name;
          }
          return update;
        })
        .filter((u): u is { id: number | string; name?: string; checked: boolean } => u !== null);

      await this.applyBulkItemUpdates(updates);
    },

    /**
     * Uncheck every checked item (and their families). Returns a snapshot of the
     * affected items (with their prior checked state) so callers can offer Undo.
     */
    async uncheckAllCheckedItems(): Promise<ShoppingListItem[]> {
      if (!this.shoppingList) {
        return [];
      }

      const checkedItems = this.shoppingList.items.filter((item) => item.checked);
      const ids = new Set<number | string>();

      for (const item of checkedItems) {
        for (const familyId of getShoppingListFamilyIds(item, this.shoppingList.items)) {
          ids.add(familyId);
        }
      }

      const snapshot = [...ids]
        .map((id) => this.shoppingList?.items.find((entry) => entry.id === id))
        .filter((item): item is ShoppingListItem => item !== undefined)
        .map((item) => ({ ...item }));

      const updates = snapshot.map((item) => ({ id: item.id, checked: false }));

      await this.applyBulkItemUpdates(updates);
      return snapshot;
    },

    /**
     * Delete every checked item (and their families). Returns a snapshot of the
     * removed items so callers can offer Undo.
     */
    async deleteAllCheckedItems(): Promise<ShoppingListItem[]> {
      if (!this.shoppingList) {
        return [];
      }

      const checkedItems = this.shoppingList.items.filter((item) => item.checked);
      const ids = new Set<number | string>();

      for (const item of checkedItems) {
        for (const familyId of getShoppingListFamilyIds(item, this.shoppingList.items)) {
          ids.add(familyId);
        }
      }

      const snapshot = this.shoppingList.items
        .filter((item) => ids.has(item.id))
        .map((item) => ({ ...item }));

      await this.applyBulkDelete([...ids]);
      return snapshot;
    },

    /**
     * Persist a temporary item to the server once it has a name.
     */
    async persistTempItem(itemId: number | string, name: string) {
      const userStore = useUserStore();
      const { api } = useApi();

      if (!this.shoppingList || !userStore.user?.family_group_id) {
        return;
      }

      const existing = this.shoppingList.items.find(item => item.id === itemId);
      if (!existing) {
        return;
      }

      const resolvedParentId = existing.parent_item_id ?? null;

      try {
        const response = await api(`/api/shopping-list/${userStore.user.family_group_id}/items`, {
          method: 'POST',
          body: {
            name,
            parent_item_id: resolvedParentId
          },
        });

        const newItem = unwrapShoppingResponse<ShoppingListItem>(response);
        const index = this.shoppingList.items.findIndex(item => item.id === itemId);
        if (index !== -1) {
          this.shoppingList.items[index] = newItem;
        }

        this.pendingChanges.add = this.pendingChanges.add.filter(i => String(i.id) !== String(itemId));
        await this.saveToLocalStorage();
        this.error = null;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to persist item';
        console.error('Failed to persist temporary item:', error);
        this.enqueueTempAddIfNotQueued(itemId);
      }
    },

    /**
     * Delete an item from the shopping list (offline-first)
     * @param itemId - The ID of the item to delete
     */
    async deleteItem(itemId: number | string) {
      const userStore = useUserStore();
      const isTemp = this.isTempId(itemId);

      // Remove from local state immediately
      if (this.shoppingList) {
        this.shoppingList.items = this.shoppingList.items.filter(item => item.id !== itemId);
        this.scheduleSaveToLocalStorage();
      }

      // If it's a temporary item, just remove from pending adds
      if (isTemp) {
        this.pendingChanges.add = this.pendingChanges.add.filter(i => String(i.id) !== String(itemId));
        return;
      }

      // Add to pending deletes
      this.pendingChanges.delete.push(itemId as number);

      // Try to sync with server
      try {
        const { api } = useApi();
        await api(`/api/shopping-list/${userStore.user?.family_group_id}/items/${itemId}`, {
          method: 'DELETE' as any,
        });
        // Remove from pending deletes
        this.pendingChanges.delete = this.pendingChanges.delete.filter(id => id !== itemId);
        await this.saveToLocalStorage();
        this.error = null;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to sync delete';
        console.error('Failed to sync item deletion with server:', err);
      }
    },

    /**
     * Sync pending changes with the server
     */
    async syncPendingChanges() {
      const userStore = useUserStore();
      const { checkConnection } = useConnection();

      // Check connection first
      const isConnected = await checkConnection();
      if (!isConnected) {
        console.log('No connection available, skipping sync');
        return;
      }

      // Sync additions
      const { api } = useApi();
      for (const item of [...this.pendingChanges.add]) {
        if (!item.name?.trim()) {
          continue;
        }
        try {
          const response = await api(`/api/shopping-list/${userStore.user?.family_group_id}/items`, {
            method: 'POST',
            body: {
              name: item.name,
              parent_item_id: item.parent_item_id ?? null
            },
          });
          const newItem = unwrapShoppingResponse<ShoppingListItem>(response);

          // Update the item in the list with the real ID
          if (this.shoppingList) {
            const index = this.shoppingList.items.findIndex(i => String(i.id) === String(item.id));
            if (index !== -1) {
              this.shoppingList.items[index] = newItem;
            }
          }
          this.pendingChanges.add = this.pendingChanges.add.filter(i => String(i.id) !== String(item.id));
          await this.saveToLocalStorage();
        } catch (err) {
          console.error('Failed to sync added item:', err);
          // Check connection again after error
          const stillConnected = await checkConnection();
          if (!stillConnected) {
            console.log('Lost connection, stopping sync');
            break;
          }
        }
      }

      // Sync updates
      for (const item of [...this.pendingChanges.update]) {
        try {
          // Only send name and checked fields to the API
          const apiUpdates = {
            name: item.name,
            checked: item.checked
          };

          await api(`/api/shopping-list/${userStore.user?.family_group_id}/items/${item.id}`, {
            method: 'PUT',
            body: apiUpdates,
          });
          this.pendingChanges.update = this.pendingChanges.update.filter(i => i.id !== item.id);
          await this.saveToLocalStorage();
        } catch (err) {
          console.error('Failed to sync updated item:', err);
          const stillConnected = await checkConnection();
          if (!stillConnected) {
            console.log('Lost connection, stopping sync');
            break;
          }
        }
      }

      // Sync deletes
      for (const itemId of [...this.pendingChanges.delete]) {
        try {
          await api(`/api/shopping-list/${userStore.user?.family_group_id}/items/${itemId}`, {
            method: 'DELETE' as any,
          });
          this.pendingChanges.delete = this.pendingChanges.delete.filter(id => id !== itemId);
          await this.saveToLocalStorage();
        } catch (err) {
          console.error('Failed to sync deleted item:', err);
          const stillConnected = await checkConnection();
          if (!stillConnected) {
            console.log('Lost connection, stopping sync');
            break;
          }
        }
      }

      // Sync reorders
      if (this.pendingChanges.reorder.length) {
        const uniqueById = new Map<number, { id: number; parent_item_id: number | null; position: number }>();
        for (const change of this.pendingChanges.reorder) {
          if (typeof change.id === 'number') {
            uniqueById.set(change.id, {
              id: change.id,
              parent_item_id: change.parent_item_id,
              position: change.position
            });
          }
        }

        const items = Array.from(uniqueById.values());

        try {
          await api(`/api/shopping-list/${userStore.user?.family_group_id}/items/reorder`, {
            method: 'PUT',
            body: { items },
          });

          this.pendingChanges.reorder = [];
          await this.saveToLocalStorage();
        } catch (err) {
          console.error('Failed to sync reordered items:', err);
        }
      }
    },

    /**
     * Record a local reorder operation for an item.
     * This updates local state immediately and queues the change for sync.
     */
    recordReorder(change: { id: number | string; parent_item_id: number | null; position: number }) {
      if (!this.shoppingList) {
        return;
      }

      const index = this.shoppingList.items.findIndex(item => item.id === change.id);
      if (index === -1) {
        return;
      }

      this.shoppingList.items[index] = {
        ...this.shoppingList.items[index],
        parent_item_id: change.parent_item_id,
        position: change.position
      };

      if (typeof change.id === 'number') {
        const existingIndex = this.pendingChanges.reorder.findIndex(entry => entry.id === change.id);
        if (existingIndex !== -1) {
          this.pendingChanges.reorder[existingIndex] = {
            id: change.id,
            parent_item_id: change.parent_item_id,
            position: change.position,
          };
        } else {
          this.pendingChanges.reorder.push({
            id: change.id,
            parent_item_id: change.parent_item_id,
            position: change.position,
          });
        }
      }
    },

    applyActiveFlatOrder(flatActiveItems: ShoppingListItem[]) {
      if (!this.shoppingList) {
        return;
      }

      const changes = rebuildItemHierarchyFromFlatOrder(flatActiveItems);
      for (const change of changes) {
        this.recordReorder(change);
      }

      this.scheduleSaveToLocalStorage();
    },

    getActiveFlatItems(): ShoppingListItem[] {
      if (!this.shoppingList?.items) {
        return [];
      }

      return flattenShoppingListItems(
        this.shoppingList.items.filter(item => !item.checked)
      );
    },

    /**
     * Indent an item, making it a child of the previous item in the ordered list.
     */
    async indentItem(itemId: number | string) {
      if (!this.shoppingList) {
        return;
      }

      const activeItems = this.getActiveFlatItems();
      const updatedItems = indentShoppingListActiveItem(activeItems, itemId);
      if (!updatedItems) {
        return;
      }

      this.applyActiveFlatOrder(updatedItems);
      await this.syncPendingChanges();
    },

    /**
     * Outdent an item, moving it up one level in the hierarchy.
     */
    async outdentItem(itemId: number | string) {
      if (!this.shoppingList) {
        return;
      }

      const activeItems = this.getActiveFlatItems();
      const target = activeItems.find(item => item.id === itemId);
      if (!target || target.parent_item_id === null) {
        return;
      }

      const parent = this.shoppingList.items.find(item => item.id === target.parent_item_id);
      const updatedItems = activeItems.map((item) => (
        item.id === itemId
          ? { ...item, parent_item_id: parent?.parent_item_id ?? null }
          : item
      ));

      this.applyActiveFlatOrder(updatedItems);
      await this.syncPendingChanges();
    },

    /**
     * Insert a new temporary item directly after an existing item, preserving its parent.
     * This only updates local state; the item is persisted when its name is later set.
     */
    async insertItemAfter(existingItemId: number | string, name: string) {
      if (!this.shoppingList) {
        return;
      }

      const existingIndex = this.shoppingList.items.findIndex(item => item.id === existingItemId);
      if (existingIndex === -1) {
        await this.addItem({ name, parentItemId: null });
        return;
      }

      const existing = this.shoppingList.items[existingIndex];
      const tempId = this.generateTempId();
      const createdById = useUserStore().user?.id || 0;
      const parentId = existing.parent_item_id ?? null;

      const tempItem: ShoppingListItem = {
        id: tempId,
        shopping_list_id: this.shoppingList.id,
        name,
        checked: false,
        deleted: false,
        parent_item_id: parentId,
        position: existing.position,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: createdById
      };

      this.shoppingList.items.splice(existingIndex + 1, 0, tempItem);

      const siblings = this.shoppingList.items
        .filter(item => item.parent_item_id === parentId)
        .sort((a, b) => a.position - b.position);

      siblings.forEach((item, index) => {
        item.position = index;
      });

      this.pendingChanges.add.push(tempItem);
      this.scheduleSaveToLocalStorage();
    }
  }
});
