import { defineStore } from 'pinia';
import { Preferences } from '@capacitor/preferences';
import type { ShoppingList, ShoppingListCategoryWithItems, ShoppingListItem, ItemCategory } from '~/types/ShoppingList'

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
      delete: []
    }
  }),

  getters: {
    /**
     * Get all items belonging to a specific category
     * @param state - The store state
     * @returns A function that takes a categoryId and returns filtered items
     */
    getItemsByCategory: (state) => (categoryId: number) => {
      const category = state.shoppingList?.categories.find(c => c.id === categoryId);
      return category?.items || [];
    },

    /**
     * Get a category by its ID
     * @param state - The store state
     * @returns A function that takes a categoryId and returns the matching category
     */
    getCategoryById: (state) => (categoryId: number) => {
      return state.shoppingList?.categories.find(category => category.id === categoryId);
    },

    /**
     * Get an item category by its ID
     * @param state - The store state
     * @returns A function that takes a categoryId and returns the matching item category
     */
    getItemCategoryById: (state) => (categoryId: number) => {
      return state.itemCategories.find(category => category.id === categoryId);
    },

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
        const response = await $fetch('/api/health', { 
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
      const authStore = useAuthStore();
      try {
        if (!this.shoppingList || forceRefresh) {
          this.isLoading = true;
          this.error = null;
          const response = await $fetch(`/api/shopping-list/${authStore.user?.family_group_id}`, {
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
        const response = await $fetch('/api/item-categories', {
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
    async addItem(item: { name: string, shopping_list_categories: number }) {
      const authStore = useAuthStore();
      const tempId = this.generateTempId();
      const createdById = authStore.user?.id || 0;
      
      // Create a temporary item
      const tempItem: ShoppingListItem = {
        id: tempId as unknown as number,
        shopping_list_id: this.shoppingList?.id || 0,
        shopping_list_categories: item.shopping_list_categories,
        name: item.name,
        checked: false,
        deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: createdById
      };

      // Add to local state immediately
      const category = this.shoppingList?.categories.find(c => c.id === item.shopping_list_categories);
      if (category) {
        category.items.push(tempItem);
        await this.saveToLocalStorage();
      }

      // Add to pending changes
      this.pendingChanges.add.push(tempItem);

      // Try to sync with server
      try {
        const response = await $fetch(`/api/shopping-list/${authStore.user?.family_group_id}/items`, {
          method: 'POST',
          body: item,
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });

        const newItem = response as ShoppingListItem;
        
        // Update the item in the category with the real ID
        if (category) {
          const index = category.items.findIndex(i => String(i.id) === tempId);
          if (index !== -1) {
            category.items[index] = newItem;
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
      const isTemp = this.isTempId(itemId);
      
      // Update local state immediately
      if (this.shoppingList) {
        let itemUpdated = false;
        for (const category of this.shoppingList.categories) {
          const index = category.items.findIndex(item => item.id === itemId);
          if (index !== -1) {
            category.items[index] = { ...category.items[index], ...updates };
            itemUpdated = true;
            break;
          }
        }
        await this.saveToLocalStorage();
      }

      // If it's a temporary item, no need to sync with server
      if (isTemp) {
        return;
      }

      // Add to pending changes
      const updatedItem = this.shoppingList?.categories
        .flatMap(c => c.items)
        .find(i => i.id === itemId);
      if (updatedItem) {
        this.pendingChanges.update.push(updatedItem);
      }

      // Try to sync with server
      try {
        const response = await $fetch(`/api/shopping-list/${authStore.user?.family_group_id}/items/${itemId}`, {
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
          let itemUpdated = false;
          for (const category of this.shoppingList.categories) {
            const index = category.items.findIndex(item => item.id === itemId);
            if (index !== -1) {
              category.items[index] = serverUpdatedItem;
              itemUpdated = true;
              break;
            }
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
     * Delete an item from the shopping list (offline-first)
     * @param itemId - The ID of the item to delete
     */
    async deleteItem(itemId: number | string) {
      const authStore = useAuthStore();
      const isTemp = this.isTempId(itemId);
      
      // Remove from local state immediately
      if (this.shoppingList) {
        for (const category of this.shoppingList.categories) {
          const index = category.items.findIndex(item => item.id === itemId);
          if (index !== -1) {
            category.items.splice(index, 1);
            await this.saveToLocalStorage();
            break;
          }
        }
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
        await $fetch(`/api/shopping-list/${authStore.user?.family_group_id}/items/${itemId}`, {
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
     * Delete a category from the shopping list
     * @param categoryId - The ID of the category to delete
     */
    async deleteCategory(categoryId: number) {
      const authStore = useAuthStore();
      try {
        this.isLoading = true;
        this.error = null;
        await $fetch(`/api/shopping-list/${authStore.user?.family_group_id}/categories/${categoryId}`, {
          method: 'DELETE' as any,
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to delete category';
        throw err;
      } finally {
        // Remove the category from the shopping list
        if (this.shoppingList) {
          const index = this.shoppingList.categories.findIndex(category => category.id === categoryId);
          if (index !== -1) {
            this.shoppingList.categories.splice(index, 1);
            await this.saveToLocalStorage();
          }
        }
        this.isLoading = false;
      }
    },

    /**
     * Add a new category to the shopping list
     * @param category - The item category to add
     */
    async addCategory(category: ItemCategory) {
      if (!this.shoppingList) throw new Error('No shopping list found');
      const authStore = useAuthStore();
      try {
        this.isLoading = true;
        this.error = null;
        const response = await $fetch(`/api/shopping-list/${authStore.user?.family_group_id}/categories/${category.id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });
        const newCategory = response.data as ShoppingListCategoryWithItems;

        // Create a complete category object with the itemCategory data
        const completeCategory: ShoppingListCategoryWithItems = {
          ...newCategory,
          itemCategory: category,
          items: newCategory.items || []
        };

        // Add the new category to the shopping list
        if (this.shoppingList.categories) {
          this.shoppingList.categories.push(completeCategory);
        } else {
          this.shoppingList.categories = [completeCategory];
        }
        
        // Save to local storage
        await this.saveToLocalStorage();
        
        // Fetch the updated shopping list to ensure we have the latest data
        await this.fetchShoppingList();
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to add category';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Update the order of categories in the shopping list
     * @param familyGroupId - The ID of the family group
     * @param categories - The new order of categories
     */
    async updateCategoryOrder(familyGroupId: number, categories: ShoppingListCategoryWithItems[]) {
      if (!this.shoppingList) throw new Error('No shopping list found');
      try {
        this.isLoading = true;
        this.error = null;
        await $fetch(`/api/shopping-list/${familyGroupId}/categories/order`, {
          method: 'PUT' as any,
          body: { categories }
        });
        this.shoppingList.categories = categories;
        await this.saveToLocalStorage();
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to update category order';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Sync pending changes with the server
     */
    async syncPendingChanges() {
      const authStore = useAuthStore();
      const { checkConnection } = useConnection();
      
      // Check connection first
      const isConnected = await checkConnection();
      if (!isConnected) {
        console.log('No connection available, skipping sync');
        return;
      }

      // Sync additions
      for (const item of [...this.pendingChanges.add]) {
        try {
          const response = await $fetch(`/api/shopping-list/${authStore.user?.family_group_id}/items`, {
            method: 'POST',
            body: {
              name: item.name,
              shopping_list_categories: item.shopping_list_categories
            },
            headers: {
              'Authorization': `Bearer ${authStore.accessToken}`,
              'x-refresh-token': authStore.refreshToken || ''
            }
          });
          const newItem = response as ShoppingListItem;
          
          // Update the item in the category with the real ID
          if (this.shoppingList) {
            for (const category of this.shoppingList.categories) {
              const index = category.items.findIndex(i => String(i.id) === String(item.id));
              if (index !== -1) {
                category.items[index] = newItem;
                break;
              }
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
          await $fetch(`/api/shopping-list/${authStore.user?.family_group_id}/items/${item.id}`, {
            method: 'PUT',
            body: item,
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
          await $fetch(`/api/shopping-list/${authStore.user?.family_group_id}/items/${itemId}`, {
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
    }
  }
});

