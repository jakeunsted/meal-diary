import { defineStore } from 'pinia';
import { useUserStore } from './user';
import { useApi } from '~/composables/useApi';
import type {
  ImportRecipeFromUrlPayload,
  Recipe,
  RecipeCategory,
  RecipeIngredient,
  RecipeState,
} from '~/types/Recipe';

export const useRecipeStore = defineStore('recipe', {
  state: (): RecipeState => ({
    recipes: [],
    categories: [],
    currentRecipe: null,
    loading: false,
    searchQuery: '',
  }),

  getters: {
    filteredRecipes: (state): Recipe[] => {
      if (!state.searchQuery) return state.recipes;
      const query = state.searchQuery.toLowerCase();
      return state.recipes.filter(recipe =>
        recipe.name.toLowerCase().includes(query)
      );
    },
  },

  actions: {
    async fetchRecipes(search?: string) {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      try {
        this.loading = true;
        const { api } = useApi();
        const queryParams = search ? `?search=${encodeURIComponent(search)}` : '';
        const response = await api<Recipe[]>(
          `/api/recipes/family/${userStore.user.family_group_id}${queryParams}`
        );
        this.recipes = response;
      } catch (error) {
        console.error('Error fetching recipes:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchRecipeById(id: number) {
      try {
        this.loading = true;
        const { api } = useApi();
        const response = await api<Recipe>(`/api/recipes/${id}`);
        this.currentRecipe = response;
        return response;
      } catch (error) {
        console.error('Error fetching recipe:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchCategories() {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      try {
        const { api } = useApi();
        const response = await api<{ categories: RecipeCategory[] }>(
          `/api/family-groups/${userStore.user.family_group_id}/recipe-categories`
        );
        this.categories = response.categories ?? [];
        return this.categories;
      } catch (error) {
        console.error('Error fetching recipe categories:', error);
        throw error;
      }
    },

    async createCategory(name: string) {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      const { api } = useApi();
      const response = await api<{ category: RecipeCategory }>(
        `/api/family-groups/${userStore.user.family_group_id}/recipe-categories`,
        {
          method: 'POST',
          body: { name },
          silent: true,
        }
      );
      await this.fetchCategories();
      return response.category;
    },

    async renameCategory(categoryId: number, name: string) {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      const { api } = useApi();
      const response = await api<{ category: RecipeCategory }>(
        `/api/family-groups/${userStore.user.family_group_id}/recipe-categories/${categoryId}`,
        {
          method: 'PATCH',
          body: { name },
          silent: true,
        }
      );
      await Promise.all([this.fetchCategories(), this.fetchRecipes()]);
      return response.category;
    },

    async deleteCategory(categoryId: number) {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      const { api } = useApi();
      await api(
        `/api/family-groups/${userStore.user.family_group_id}/recipe-categories/${categoryId}`,
        {
          method: 'DELETE',
          silent: true,
        }
      );
      await Promise.all([this.fetchCategories(), this.fetchRecipes()]);
    },

    async createRecipe(recipeData: {
      name: string;
      description?: string;
      instructions?: string;
      portions?: number;
      ingredients?: RecipeIngredient[];
      category_ids?: number[];
    }) {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      try {
        this.loading = true;
        const { api } = useApi();
        const response = await api<Recipe>('/api/recipes', {
          method: 'POST',
          body: {
            family_group_id: userStore.user.family_group_id,
            ...recipeData,
          },
        });
        this.recipes.push(response);
        return response;
      } catch (error) {
        console.error('Error creating recipe:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async importRecipeFromUrl({ url }: ImportRecipeFromUrlPayload) {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      try {
        this.loading = true;
        const { api } = useApi();
        const response = await api<Recipe>('/api/recipes/import-from-url', {
          method: 'POST',
          body: {
            family_group_id: userStore.user.family_group_id,
            url,
          },
        });
        this.recipes.push(response);
        this.currentRecipe = response;
        return response;
      } catch (error) {
        console.error('Error importing recipe:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateRecipe(id: number, recipeData: {
      name?: string;
      description?: string;
      instructions?: string;
      portions?: number;
      ingredients?: RecipeIngredient[];
      category_ids?: number[];
    }) {
      try {
        this.loading = true;
        const { api } = useApi();
        const response = await api<Recipe>(`/api/recipes/${id}`, {
          method: 'PUT',
          body: recipeData,
        });
        const index = this.recipes.findIndex(r => r.id === id);
        if (index !== -1) {
          this.recipes[index] = response;
        }
        if (this.currentRecipe?.id === id) {
          this.currentRecipe = response;
        }
        return response;
      } catch (error) {
        console.error('Error updating recipe:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async deleteRecipe(id: number) {
      try {
        this.loading = true;
        const { api } = useApi();
        await api(`/api/recipes/${id}`, { method: 'DELETE' });
        this.recipes = this.recipes.filter(r => r.id !== id);
        if (this.currentRecipe?.id === id) {
          this.currentRecipe = null;
        }
      } catch (error) {
        console.error('Error deleting recipe:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    setSearchQuery(query: string) {
      this.searchQuery = query;
    },
  },
});
