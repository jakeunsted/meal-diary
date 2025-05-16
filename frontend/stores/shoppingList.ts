import { defineStore } from 'pinia';
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
    // Save to localStorage
    saveToLocalStorage() {
      if (import.meta.client && this.shoppingList) {
        localStorage.setItem('shoppingList', JSON.stringify(this.shoppingList));
      }
    },

    // Load from localStorage
    loadFromLocalStorage() {
      if (import.meta.client) {
        const storedData = localStorage.getItem('shoppingList');
        if (storedData) {
          try {
            this.shoppingList = JSON.parse(storedData);
            return true;
          } catch (error) {
            console.error('Failed to parse stored shopping list:', error);
            localStorage.removeItem('shoppingList');
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
          // Save to localStorage after successful fetch
          this.saveToLocalStorage();
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch shopping list';
        // If fetch fails, try to load from localStorage
        const loadedFromStorage = this.loadFromLocalStorage();
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
          // Save to localStorage after successful update
          this.saveToLocalStorage();
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
          // Save to localStorage after successful update
          this.saveToLocalStorage();
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
    handleCategoryAdded(familyGroupId: number, categoryName: string, categoryData: ShoppingListCategory) {
      if (this.shoppingList?.content) {
        // Check if this category already exists (avoid duplicates)
        const existingCategory = this.shoppingList.content.categories.find(
          category => category.name === categoryName
        );
        
        if (!existingCategory) {
          this.shoppingList.content.categories.push(categoryData);
          // Save to localStorage after receiving update
          this.saveToLocalStorage();
        }
      }
    },
    
    /**
     * Handle a category that was updated by another client via webhook
     */
    handleCategorySaved(familyGroupId: number, categoryName: string, categoryData: ShoppingListCategory) {
      if (this.shoppingList?.content) {
        const categoryIndex = this.shoppingList.content.categories.findIndex(
          category => category.name === categoryName
        );
        
        if (categoryIndex !== -1) {
          // Update the existing category with new data
          this.shoppingList.content.categories[categoryIndex].items = categoryData.items;
          // Save to localStorage after receiving update
          this.saveToLocalStorage();
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
        // Save to localStorage after local update
        this.saveToLocalStorage();
      }
    }
  }
})
