import { defineStore } from 'pinia';
import { Preferences } from '@capacitor/preferences';
import type { ShoppingList, ShoppingListCategory, ShoppingListItem, ItemCategory } from '~/types/ShoppingList'

/**
 * State interface for the shopping list store
 * @interface ShoppingListState
 */
export interface ShoppingListState {
  shoppingList: ShoppingList | null;
  categories: ShoppingListCategory[];
  items: ShoppingListItem[];
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
    categories: [],
    items: [],
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
      return state.items.filter(item => item.shopping_list_categories === categoryId);
    },

    /**
     * Get a category by its ID
     * @param state - The store state
     * @returns A function that takes a categoryId and returns the matching category
     */
    getCategoryById: (state) => (categoryId: number) => {
      return state.categories.find(category => category.id === categoryId);
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
     * Save the current shopping list state to local storage
     */
    async saveToLocalStorage() {
      if (import.meta.client) {
        await Preferences.set({
          key: 'shoppingList',
          value: JSON.stringify({
            shoppingList: this.shoppingList,
            categories: this.categories,
            items: this.items,
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
            this.categories = data.categories;
            this.items = data.items;
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
     * @param familyGroupId - The ID of the family group
     * @param forceRefresh - Whether to force a refresh from the server
     */
    async fetchShoppingList(familyGroupId: number, forceRefresh = false) {
      try {
        if (!this.shoppingList || forceRefresh) {
          this.isLoading = true;
          this.error = null;
          const response = await $fetch<ShoppingList>(`/api/shopping-list/${familyGroupId}`);
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
        const response = await $fetch<ItemCategory[]>('/api/item-categories', {
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });
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
     * @param familyGroupId - The ID of the family group
     * @param item - The item data to add
     */
    async addItem(familyGroupId: number, item: { name: string, shopping_list_categories: number }) {
      const authStore = useAuthStore();
      try {
        this.isLoading = true;
        this.error = null;
        const response = await $fetch<ShoppingListItem>(`/api/shopping-list/${familyGroupId}/items`, {
          method: 'POST',
          body: item,
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });
        this.items.push(response);
        await this.saveToLocalStorage();
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to add item';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Update an existing item in the shopping list
     * @param familyGroupId - The ID of the family group
     * @param itemId - The ID of the item to update
     * @param updates - The updates to apply to the item
     */
    async updateItem(familyGroupId: number, itemId: number, updates: Partial<ShoppingListItem>) {
      const authStore = useAuthStore();
      try {
        this.isLoading = true;
        this.error = null;
        const response = await $fetch<ShoppingListItem>(`/api/shopping-list/${familyGroupId}/items/${itemId}`, {
          method: 'PUT',
          body: updates,
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });
        const index = this.items.findIndex(item => item.id === itemId);
        if (index !== -1) {
          this.items[index] = response;
          await this.saveToLocalStorage();
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
     * @param familyGroupId - The ID of the family group
     * @param itemId - The ID of the item to delete
     */
    async deleteItem(familyGroupId: number, itemId: number) {
      const authStore = useAuthStore();
      try {
        this.isLoading = true;
        this.error = null;
        await $fetch(`/api/shopping-list/${familyGroupId}/items/${itemId}`, {
          method: 'DELETE' as any,
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });
        this.items = this.items.filter(item => item.id !== itemId);
        await this.saveToLocalStorage();
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to delete item';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Delete a category from the shopping list
     * @param familyGroupId - The ID of the family group
     * @param categoryId - The ID of the category to delete
     */
    async deleteCategory(familyGroupId: number, categoryId: number) {
      const authStore = useAuthStore();
      try {
        this.isLoading = true;
        this.error = null;
        await $fetch(`/api/shopping-list/${familyGroupId}/categories/${categoryId}`, {
          method: 'DELETE' as any,
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });
        this.categories = this.categories.filter(category => category.id !== categoryId);
        this.items = this.items.filter(item => item.shopping_list_categories !== categoryId);
        await this.saveToLocalStorage();
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
        const response = await $fetch<ShoppingListCategory>(`/api/shopping-list/${this.shoppingList.family_group_id}/categories`, {
          method: 'POST',
          body: {
            item_categories_id: category.id
          },
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });
        this.categories.push(response);
        await this.saveToLocalStorage();
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to add category';
        throw err;
      } finally {
        this.isLoading = false;
      }
    }
  }
})
