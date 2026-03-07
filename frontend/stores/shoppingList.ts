import { defineStore } from 'pinia';
import { Preferences } from '@capacitor/preferences';
import type { ShoppingList, ShoppingListCategoryWithItems, ShoppingListItem, ItemCategory } from '~/types/ShoppingList'
import { useApi } from '~/composables/useApi';

// Temporary ID prefix for offline items
const TEMP_ID_PREFIX = 'temp_';

/**
 * State interface for the shopping list store
 * @interface ShoppingListState
 */
export interface ShoppingListState {
  shoppingList: ShoppingList | null;
  itemCategories: ItemCategory[];
  isLoading: boolean;
  error: string | null;
  pendingChanges: {
    add: ShoppingListItem[];
    update: ShoppingListItem[];
    delete: number[];
    reorder: { id: number | string; parent_item_id: number | null; position: number }[];
  };
}

/**
 * Store for managing shopping list data and operations
 */
export const useShoppingListStore = defineStore('shoppingList', {
  state: (): ShoppingListState => ({
    shoppingList: null,
    itemCategories: [],
    isLoading: false,
    error: null,
    pendingChanges: {
      add: [],
      update: [],
      delete: [],
      reorder: []
    }
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
            itemCategories: this.itemCategories,
            pendingChanges: this.pendingChanges
          })
        });
      }
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
            this.itemCategories = data.itemCategories;
            this.pendingChanges = data.pendingChanges || { add: [], update: [], delete: [] };
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
     * Check if there is an active internet connection
     */
    async checkConnection(): Promise<boolean> {
      try {
        const { api } = useApi();
        await api('/api/health', { 
          method: 'GET',
          timeout: 5000 // 5 second timeout
        });
        return true;
      } catch {
        return false;
      }
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
      
      try {
        if (!this.shoppingList || forceRefresh) {
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
          const response = await api(`/api/shopping-list/${familyGroupId}`, {
            headers: {
              'Authorization': `Bearer ${authStore.accessToken}`,
              'x-refresh-token': authStore.refreshToken || ''
            }
          });
          const shoppingList = response.data as ShoppingList;
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
        this.isLoading = false;
      }
    },

    /**
     * Fetch all item categories
     */
    async fetchItemCategories() {
      const authStore = useAuthStore();
      try {
        this.isLoading = true;
        this.error = null;
        const { api } = useApi();
        const response = await api('/api/item-categories', {
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        })
        const itemCategories = response.data as ItemCategory[];
        this.itemCategories = itemCategories;
        await this.saveToLocalStorage();
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch item categories';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Add a new item to the shopping list (offline-first)
     * @param item - The item data to add
     */
    async addItem(item: { name: string; parentItemId?: number | null }) {
      const authStore = useAuthStore();
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
        id: tempId as unknown as number,
        shopping_list_id: this.shoppingList?.id || 0,
        shopping_list_categories: 0,
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
        await this.saveToLocalStorage();
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
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });

        const newItem = response as ShoppingListItem;
        
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
      } catch (err) {
        // Keep the temporary item in the UI and pending changes
        console.error('Failed to sync item with server:', err);
      }
    },

    /**
     * Update an existing item in the shopping list (offline-first)
     * @param itemId - The ID of the item to update
     * @param updates - The updates to apply to the item
     */
    async updateItem(itemId: number | string, updates: Partial<ShoppingListItem>) {
      const authStore = useAuthStore();
      const userStore = useUserStore();
      const isTemp = this.isTempId(itemId);
      
      // Update local state immediately
      if (this.shoppingList) {
        const index = this.shoppingList.items.findIndex(item => item.id === itemId);
        if (index !== -1) {
          this.shoppingList.items[index] = { ...this.shoppingList.items[index], ...updates };
        }
        await this.saveToLocalStorage();
      }

      // If it's a temporary item, no need to sync with server
      if (isTemp) {
        if (updates.name && typeof updates.name === 'string' && updates.name.trim()) {
          await this.persistTempItem(itemId, updates.name);
        }
        return;
      }

      // Add to pending changes
      const updatedItem = this.shoppingList?.items.find(i => i.id === itemId);
      if (updatedItem) {
        this.pendingChanges.update.push(updatedItem);
      }

      // Try to sync with server
      try {
        const { api } = useApi();
        const response = await api(`/api/shopping-list/${userStore.user?.family_group_id}/items/${itemId}`, {
          method: 'PUT',
          body: updates,
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });
        const serverUpdatedItem = response.data as ShoppingListItem;

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

        return serverUpdatedItem;
      } catch (err) {
        // Keep the local changes and pending updates
        console.error('Failed to sync item update with server:', err);
      }
    },

    /**
     * Persist a temporary item to the server once it has a name.
     */
    async persistTempItem(itemId: number | string, name: string) {
      const authStore = useAuthStore();
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
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });

        const newItem = response as ShoppingListItem;
        const index = this.shoppingList.items.findIndex(item => item.id === itemId);
        if (index !== -1) {
          this.shoppingList.items[index] = newItem;
        }

        await this.saveToLocalStorage();
      } catch (error) {
        console.error('Failed to persist temporary item:', error);
      }
    },

    /**
     * Delete an item from the shopping list (offline-first)
     * @param itemId - The ID of the item to delete
     */
    async deleteItem(itemId: number | string) {
      const authStore = useAuthStore();
      const userStore = useUserStore();
      const isTemp = this.isTempId(itemId);
      
      // Remove from local state immediately
      if (this.shoppingList) {
        this.shoppingList.items = this.shoppingList.items.filter(item => item.id !== itemId);
        await this.saveToLocalStorage();
      }

      // If it's a temporary item, just remove from pending adds
      if (isTemp) {
        this.pendingChanges.add = this.pendingChanges.add.filter(i => i.id !== itemId);
        return;
      }

      // Add to pending deletes
      this.pendingChanges.delete.push(itemId as number);

      // Try to sync with server
      try {
        const { api } = useApi();
        await api(`/api/shopping-list/${userStore.user?.family_group_id}/items/${itemId}`, {
          method: 'DELETE' as any,
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });
        // Remove from pending deletes
        this.pendingChanges.delete = this.pendingChanges.delete.filter(id => id !== itemId);
      } catch (err) {
        // Keep the local deletion and pending delete
        console.error('Failed to sync item deletion with server:', err);
      }
    },

    /**
     * Sync pending changes with the server
     */
    async syncPendingChanges() {
      const authStore = useAuthStore();
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
        try {
          const response = await api(`/api/shopping-list/${userStore.user?.family_group_id}/items`, {
            method: 'POST',
            body: {
              name: item.name,
              parent_item_id: item.parent_item_id ?? null
            },
            headers: {
              'Authorization': `Bearer ${authStore.accessToken}`,
              'x-refresh-token': authStore.refreshToken || ''
            }
          });
          const newItem = response as ShoppingListItem;
          
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
            headers: {
              'Authorization': `Bearer ${authStore.accessToken}`,
              'x-refresh-token': authStore.refreshToken || ''
            }
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
            headers: {
              'Authorization': `Bearer ${authStore.accessToken}`,
              'x-refresh-token': authStore.refreshToken || ''
            }
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
            headers: {
              'Authorization': `Bearer ${authStore.accessToken}`,
              'x-refresh-token': authStore.refreshToken || ''
            }
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
          this.pendingChanges.reorder[existingIndex] = change;
        } else {
          this.pendingChanges.reorder.push(change);
        }
      }
    },

    /**
     * Indent an item, making it a child of the previous item in the ordered list.
     */
    async indentItem(itemId: number | string) {
      if (!this.shoppingList) {
        return;
      }

      const orderedItems = [...this.shoppingList.items].sort((a, b) => a.position - b.position);
      const index = orderedItems.findIndex(item => item.id === itemId);

      if (index <= 0) {
        return;
      }

      const target = orderedItems[index];
      const previous = orderedItems[index - 1];

      if (!previous || typeof previous.id !== 'number') {
        return;
      }

      this.recordReorder({
        id: target.id,
        parent_item_id: previous.id,
        position: target.position
      });

      await this.saveToLocalStorage();
    },

    /**
     * Outdent an item, moving it up one level in the hierarchy.
     */
    async outdentItem(itemId: number | string) {
      if (!this.shoppingList) {
        return;
      }

      const target = this.shoppingList.items.find(item => item.id === itemId);
      if (!target || target.parent_item_id === null) {
        return;
      }

      this.recordReorder({
        id: target.id,
        parent_item_id: null,
        position: target.position
      });

      await this.saveToLocalStorage();
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
        id: tempId as unknown as number,
        shopping_list_id: this.shoppingList.id,
        shopping_list_categories: 0,
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

      await this.saveToLocalStorage();
    }
  }
});

