import { defineStore } from 'pinia';
import { Preferences } from '@capacitor/preferences';
import type { ShoppingList, ShoppingListCategory, ShoppingListItem, ItemCategory } from '~/types/ShoppingList'

export interface ShoppingListState {
  shoppingList: ShoppingList | null;
  categories: ShoppingListCategory[];
  items: ShoppingListItem[];
  itemCategories: ItemCategory[];
  isLoading: boolean;
  error: string | null;
}

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
    getItemsByCategory: (state) => (categoryId: number) => {
      return state.items.filter(item => item.shopping_list_categories === categoryId);
    },
    getCategoryById: (state) => (categoryId: number) => {
      return state.categories.find(category => category.id === categoryId);
    },
    getItemCategoryById: (state) => (categoryId: number) => {
      return state.itemCategories.find(category => category.id === categoryId);
    }
  },

  actions: {
    // Save to Preferences
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

    // Load from Preferences
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

    async fetchItemCategories() {
      try {
        this.isLoading = true;
        this.error = null;
        const response = await $fetch<ItemCategory[]>('/api/item-categories');
        this.itemCategories = response;
        await this.saveToLocalStorage();
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch item categories';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async fetchShoppingList(familyGroupId: number, forceRefresh = false) {
      try {
        // Only fetch if we don't have data or if force refresh is requested
        if (!this.shoppingList || forceRefresh) {
          this.isLoading = true;
          this.error = null;
          const response = await $fetch<ShoppingList>(`/api/shopping-list/${familyGroupId}`);
          this.shoppingList = response;
          // Save to Preferences after successful fetch
          await this.saveToLocalStorage();
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch shopping list';
        // If fetch fails, try to load from Preferences
        const loadedFromStorage = await this.loadFromLocalStorage();
        if (!loadedFromStorage) {
          throw err;
        }
      } finally {
        this.isLoading = false;
      }
    },

    async fetchFamilyGroupCategories(familyGroupId: number) {
      try {
        this.isLoading = true;
        this.error = null;
        const response = await $fetch<ShoppingListCategory[]>(`/api/shopping-list/${familyGroupId}/categories`);
        this.categories = response;
        await this.saveToLocalStorage();
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch categories';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async addItem(familyGroupId: number, item: { name: string, shopping_list_categories: number }) {
      try {
        this.isLoading = true;
        this.error = null;
        const response = await $fetch<ShoppingListItem>(`/api/shopping-list/${familyGroupId}/items`, {
          method: 'POST',
          body: item,
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

    async updateItem(familyGroupId: number, itemId: number, updates: Partial<ShoppingListItem>) {
      try {
        this.isLoading = true;
        this.error = null;
        const response = await $fetch<ShoppingListItem>(`/api/shopping-list/${familyGroupId}/items/${itemId}`, {
          method: 'PUT',
          body: updates,
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

    async deleteItem(familyGroupId: number, itemId: number) {
      try {
        this.isLoading = true;
        this.error = null;
        await $fetch(`/api/shopping-list/${familyGroupId}/items/${itemId}`, {
          method: 'DELETE' as any,
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

    async deleteCategory(familyGroupId: number, categoryId: number) {
      try {
        this.isLoading = true;
        this.error = null;
        await $fetch(`/api/shopping-list/${familyGroupId}/categories/${categoryId}`, {
          method: 'DELETE' as any,
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
    }
  }
})
