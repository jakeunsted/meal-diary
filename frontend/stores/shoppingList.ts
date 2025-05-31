import { defineStore } from 'pinia';
import { Preferences } from '@capacitor/preferences';
import type { ShoppingList, ShoppingListCategoryWithItems, ShoppingListItem, ItemCategory } from '~/types/ShoppingList'

/**
 * State interface for the shopping list store
 * @interface ShoppingListState
 */
export interface ShoppingListState {
  shoppingList: ShoppingList | null;
  itemCategories: ItemCategory[];
  isLoading: boolean;
  error: string | null;
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
    }
  },

  actions: {
    /**
     * Save the current state to local storage
     */
    async saveToLocalStorage() {
      if (import.meta.client) {
        await Preferences.set({
          key: 'shoppingList',
          value: JSON.stringify({
            shoppingList: this.shoppingList,
            itemCategories: this.itemCategories
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
     * Fetch the shopping list for a family group
     * @param forceRefresh - Whether to force a refresh from the server
     */
    async fetchShoppingList(forceRefresh = false) {
      const authStore = useAuthStore();
      try {
        if (!this.shoppingList || forceRefresh) {
          this.isLoading = true;
          this.error = null;
          const response = await $fetch(`/api/shopping-list/${authStore.user?.family_group_id}`) as ShoppingList;
          this.shoppingList = response;
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
        }) as ItemCategory[];
        this.itemCategories = response;
        await this.saveToLocalStorage();
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch item categories';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Add a new item to the shopping list
     * @param item - The item data to add
     */
    async addItem(item: { name: string, shopping_list_categories: number }) {
      const authStore = useAuthStore();
      try {
        this.isLoading = true;
        this.error = null;
        const response = await $fetch(`/api/shopping-list/${authStore.user?.family_group_id}/items`, {
          method: 'POST',
          body: item,
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        }) as ShoppingListItem;

        // Update the category's items array
        const category = this.shoppingList?.categories.find(c => c.id === item.shopping_list_categories);
        if (category) {
          category.items.push(response);
          await this.saveToLocalStorage();
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to add item';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Update an existing item in the shopping list
     * @param itemId - The ID of the item to update
     * @param updates - The updates to apply to the item
     */
    async updateItem(itemId: number, updates: Partial<ShoppingListItem>) {
      const authStore = useAuthStore();
      try {
        this.isLoading = true;
        this.error = null;
        const response = await $fetch(`/api/shopping-list/${authStore.user?.family_group_id}/items/${itemId}`, {
          method: 'PUT',
          body: updates,
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        }) as ShoppingListItem;

        // Update the item in the category's items array
        if (this.shoppingList) {
          for (const category of this.shoppingList.categories) {
            const index = category.items.findIndex(item => item.id === itemId);
            if (index !== -1) {
              category.items[index] = response;
              await this.saveToLocalStorage();
              break;
            }
          }
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to update item';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Delete an item from the shopping list
     * @param itemId - The ID of the item to delete
     */
    async deleteItem(itemId: number) {
      const authStore = useAuthStore();
      try {
        this.isLoading = true;
        this.error = null;
        await $fetch(`/api/shopping-list/${authStore.user?.family_group_id}/items/${itemId}`, {
          method: 'DELETE' as any,
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });

        // Remove the item from the category's items array
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
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to delete item';
        throw err;
      } finally {
        this.isLoading = false;
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

        // Remove the category from the shopping list
        if (this.shoppingList) {
          const index = this.shoppingList.categories.findIndex(category => category.id === categoryId);
          if (index !== -1) {
            this.shoppingList.categories.splice(index, 1);
            await this.saveToLocalStorage();
          }
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to delete category';
        throw err;
      } finally {
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
        }) as ShoppingListCategoryWithItems;

        // Add the new category to the shopping list
        this.shoppingList.categories.push(response);
        await this.saveToLocalStorage();
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
          method: 'PUT',
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
    }
  }
});
