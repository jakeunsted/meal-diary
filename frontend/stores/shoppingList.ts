import { defineStore } from 'pinia';
import { Preferences } from '@capacitor/preferences';
import type { ShoppingList, ShoppingListCategory, ShoppingListState } from '~/types/ShoppingList'

export const useShoppingListStore = defineStore('shoppingList', {
  state: (): ShoppingListState => ({
    shoppingList: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    getShoppingListContent: (state) => state.shoppingList?.content
  },

  actions: {
    // Save to Preferences
    async saveToLocalStorage() {
      if (import.meta.client && this.shoppingList) {
        await Preferences.set({
          key: 'shoppingList',
          value: JSON.stringify(this.shoppingList)
        });
      }
    },

    // Load from Preferences
    async loadFromLocalStorage() {
      if (import.meta.client) {
        const { value } = await Preferences.get({ key: 'shoppingList' });
        if (value) {
          try {
            this.shoppingList = JSON.parse(value);
            return true;
          } catch (error) {
            console.error('Failed to parse stored shopping list:', error);
            await Preferences.remove({ key: 'shoppingList' });
          }
        }
      }
      return false;
    },

    async fetchShoppingList(familyGroupId: number) {
      try {
        if (!this.shoppingList) {
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

    async addCategory(familyGroupId: number, categoryName: string) {
      try {
        this.isLoading = true;
        this.error = null;
        const response = await $fetch<ShoppingListCategory>(`/api/shopping-list/${familyGroupId}/new-category`, {
          method: 'POST',
          body: { category_name: categoryName },
        });
        if (this.shoppingList?.content) {
          this.shoppingList.content.categories.push(response);
          // Save to Preferences after successful update
          await this.saveToLocalStorage();
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to add category';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async saveCategory(familyGroupId: number, categoryName: string, categoryContents: ShoppingListCategory[]) {
      try {
        this.isLoading = true;
        this.error = null;
        const response = await $fetch<ShoppingListCategory>(`/api/shopping-list/${familyGroupId}/save-category`, {
          method: 'POST',
          body: { category_name: categoryName, category_contents: categoryContents },
        });
        if (this.shoppingList?.content) {
          this.shoppingList.content.categories.find(
            category => category.name === categoryName
          )!.items = response.items;
          // Save to Preferences after successful update
          await this.saveToLocalStorage();
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to save category';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Handle a category that was added by another client via webhook
     */
    async handleCategoryAdded(familyGroupId: number, categoryName: string, categoryData: ShoppingListCategory) {
      if (this.shoppingList?.content) {
        // Check if this category already exists (avoid duplicates)
        const existingCategory = this.shoppingList.content.categories.find(
          category => category.name === categoryName
        );
        
        if (!existingCategory) {
          this.shoppingList.content.categories.push(categoryData);
          // Save to Preferences after receiving update
          await this.saveToLocalStorage();
        }
      }
    },
    
    /**
     * Handle a category that was updated by another client via webhook
     */
    async handleCategorySaved(familyGroupId: number, categoryName: string, categoryData: ShoppingListCategory) {
      if (this.shoppingList?.content) {
        const categoryIndex = this.shoppingList.content.categories.findIndex(
          category => category.name === categoryName
        );
        
        if (categoryIndex !== -1) {
          // Update the existing category with new data
          this.shoppingList.content.categories[categoryIndex].items = categoryData.items;
          // Save to Preferences after receiving update
          await this.saveToLocalStorage();
        }
      }
    },

    /**
     * This method searches for a category by its name within the shopping list's content
     * and updates its items with the provided category contents.
     * 
     * @param {string} categoryName
     * @param {ShoppingListCategory} categoryContents
     * 
     * @returns {void}
     */
    async updateCategoryInStore(categoryName: string, categoryContents: ShoppingListCategory) {
      if (this.shoppingList?.content) {
        this.shoppingList.content.categories.find(
          category => category.name === categoryName
        )!.items = categoryContents.items;
        // Save to Preferences after local update
        await this.saveToLocalStorage();
      }
    }
  }
})
