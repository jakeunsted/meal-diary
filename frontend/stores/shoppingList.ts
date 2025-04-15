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
    async fetchShoppingList(familyGroupId: number) {
      try {
        if (!this.shoppingList) {
          this.isLoading = true;
          this.error = null;
          const response = await $fetch<ShoppingList>(`/api/shopping-list/${familyGroupId}`);
          this.shoppingList = response;
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch shopping list';
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
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to add category';
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
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to save category';
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
      }
    }
  }
})
