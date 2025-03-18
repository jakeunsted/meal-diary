import { defineStore } from 'pinia';
import type { ShoppingList, ShoppingListCategory } from '~/types/ShoppingList'

interface ShoppingListState {
  shoppingList: ShoppingList | null;
  isLoading: boolean;
  error: string | null;
}

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
        this.isLoading = true;
        this.error = null;
        const response = await $fetch<ShoppingList>(`/api/shopping-list/${familyGroupId}`);
        this.shoppingList = response;
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
    }
  }
})
