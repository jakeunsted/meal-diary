import { defineStore } from 'pinia';
import { useUserStore } from './user';
import { useApi } from '~/composables/useApi';
import type { Recipe, RecipeIngredient, RecipeState } from '~/types/Recipe';

export const useRecipeStore = defineStore('recipe', {
  state: (): RecipeState => ({
    recipes: [],
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

    async createRecipe(recipeData: {
      name: string;
      description?: string;
      instructions?: string;
      portions?: number;
      ingredients?: RecipeIngredient[];
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

    async updateRecipe(id: number, recipeData: {
      name?: string;
      description?: string;
      instructions?: string;
      portions?: number;
      ingredients?: RecipeIngredient[];
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
