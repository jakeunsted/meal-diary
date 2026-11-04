import { defineStore } from 'pinia';
import {
  OFFLINE_REQUEST_TIMEOUT_MS,
  mergeRecipePendingEdit,
  overlayRecipe,
  replaceById,
  toRecipeSyncValue,
  type RecipeSyncValue,
} from '@meal-diary/shared';
import { useUserStore } from './user';
import { useApi } from '~/composables/useApi';
import { usePaywall } from '~/composables/usePaywall';
import { extractEntitlementError, isNetworkError } from '~/utils/httpError';
import {
  readPendingEdits,
  readRecipesCache,
  writePendingEdits,
  writeRecipesCache,
} from '~/utils/recipeOffline';
import type {
  ImportRecipeFromUrlPayload,
  Recipe,
  RecipeCategory,
  RecipeIngredient,
  RecipePendingEdit,
  RecipeState,
  RecipeSyncConflict,
} from '~/types/Recipe';

let detailFetchSerial = 0;
let listFetchSerial = 0;
let detailFetchDepth = 0;
let listFetchDepth = 0;
let flushTail: Promise<void> = Promise.resolve();

const bumpRecipeFetches = () => {
  detailFetchSerial += 1;
  listFetchSerial += 1;
};

const enqueueRecipeFlush = (task: () => Promise<void>): Promise<void> => {
  const run = flushTail.then(task, task);
  flushTail = run.then(() => undefined, () => undefined);
  return run;
};

export const useRecipeStore = defineStore('recipe', {
  state: (): RecipeState => ({
    recipes: [],
    categories: [],
    currentRecipe: null,
    loading: false,
    saving: false,
    refreshing: false,
    loadError: false,
    searchQuery: '',
    pendingEdits: [],
    conflicts: [],
    syncing: false,
    syncFailed: false,
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
    familyId() {
      return useUserStore().user?.family_group_id ?? null;
    },

    browserIsOnline() {
      if (!import.meta.client || typeof navigator === 'undefined') {
        return true;
      }
      return navigator.onLine;
    },

    overlayPending(recipe: Recipe) {
      const edit = this.pendingEdits.find((item) => item.recipeId === recipe.id);
      return edit ? overlayRecipe(recipe, edit.recipe) : recipe;
    },

    showRecipe(recipe: Recipe) {
      const shown = this.overlayPending(recipe);
      this.recipes = replaceById(this.recipes, shown);
      if (this.currentRecipe?.id === recipe.id) {
        this.currentRecipe = shown;
      }
    },

    rememberServerRecipe(recipe: Recipe) {
      const familyId = recipe.family_group_id || this.familyId();
      if (!familyId) {
        return;
      }
      const cached = readRecipesCache(familyId);
      if (cached.length > 0) {
        writeRecipesCache(familyId, replaceById(cached, recipe));
      }
      this.showRecipe(recipe);
    },

    hydrateFromStorage() {
      const familyId = this.familyId();
      if (!familyId) {
        return;
      }
      this.pendingEdits = readPendingEdits(familyId);
      if (this.recipes.length > 0) {
        this.recipes = this.recipes.map((recipe) => this.overlayPending(recipe));
        return;
      }
      const cached = readRecipesCache(familyId);
      this.recipes = cached.map((recipe) => this.overlayPending(recipe));
    },

    hydrateCurrentRecipe(id: number) {
      this.hydrateFromStorage();
      const known = this.recipes.find((recipe) => recipe.id === id)
        ?? readRecipesCache(this.familyId() ?? 0).find((recipe) => recipe.id === id);
      if (!known) {
        if (this.currentRecipe?.id !== id) {
          this.currentRecipe = null;
        }
        return;
      }
      this.currentRecipe = this.overlayPending(known);
      this.loadError = false;
    },

    async fetchRecipes(search?: string) {
      const familyId = this.familyId();
      if (!familyId) return;

      const serial = ++listFetchSerial;
      const detailAtStart = detailFetchSerial;
      listFetchDepth += 1;
      const hadRecipes = this.recipes.length > 0;
      if (!hadRecipes) {
        this.loading = true;
      }
      try {
        const { api } = useApi();
        const queryParams = search ? `?search=${encodeURIComponent(search)}` : '';
        const response = await api<Recipe[]>(
          `/api/recipes/family/${familyId}${queryParams}`,
          { timeout: OFFLINE_REQUEST_TIMEOUT_MS, silent: true }
        );
        if (serial !== listFetchSerial || search) {
          if (search) {
            this.recipes = response.map((recipe) => this.overlayPending(recipe));
          }
          return;
        }
        writeRecipesCache(familyId, response);
        this.recipes = response.map((recipe) => this.overlayPending(recipe));
        if (this.currentRecipe) {
          const fresh = response.find((recipe) => recipe.id === this.currentRecipe?.id);
          if (fresh && detailFetchSerial === detailAtStart) {
            this.currentRecipe = this.overlayPending(fresh);
          }
        }
      } catch (error) {
        console.error('Error fetching recipes:', error);
        if (!hadRecipes && this.recipes.length === 0) {
          throw error;
        }
      } finally {
        listFetchDepth -= 1;
        if (listFetchDepth <= 0) {
          listFetchDepth = 0;
          this.loading = false;
        }
      }
    },

    async fetchRecipeById(id: number) {
      this.hydrateCurrentRecipe(id);
      const serial = ++detailFetchSerial;
      const hadRecipe = this.currentRecipe?.id === id;
      detailFetchDepth += 1;
      if (hadRecipe) {
        this.refreshing = true;
      } else {
        this.loading = true;
      }
      this.loadError = false;
      try {
        const { api } = useApi();
        const response = await api<Recipe>(`/api/recipes/${id}`, {
          timeout: OFFLINE_REQUEST_TIMEOUT_MS,
          silent: true,
        });
        if (serial !== detailFetchSerial) {
          return this.currentRecipe ?? response;
        }
        this.rememberServerRecipe(response);
        this.currentRecipe = this.overlayPending(response);
        return this.currentRecipe;
      } catch (error) {
        console.error('Error fetching recipe:', error);
        if (!hadRecipe && this.currentRecipe?.id !== id) {
          this.loadError = true;
        }
        return this.currentRecipe;
      } finally {
        detailFetchDepth -= 1;
        if (detailFetchDepth <= 0) {
          detailFetchDepth = 0;
          this.loading = false;
          this.refreshing = false;
        }
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
          timeout: OFFLINE_REQUEST_TIMEOUT_MS,
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
          timeout: OFFLINE_REQUEST_TIMEOUT_MS,
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
    }, baseline?: RecipeSyncValue | null) {
      const current = this.currentRecipe?.id === id
        ? this.currentRecipe
        : this.recipes.find((recipe) => recipe.id === id);
      const yours = toRecipeSyncValue({
        ...current,
        ...recipeData,
        category_ids: recipeData.category_ids ?? current?.categories?.map((category) => category.id),
      });
      const startingBaseline = baseline ?? (current ? toRecipeSyncValue(current) : yours);
      const hasPending = this.pendingEdits.some((edit) => edit.recipeId === id);

      this.saving = true;
      bumpRecipeFetches();
      try {
        if (!this.browserIsOnline() || hasPending) {
          await this.queueRecipeEdit(id, startingBaseline, yours);
          if (this.browserIsOnline()) {
            await this.flushPending();
          }
          return this.currentRecipe;
        }

        const { api } = useApi();
        const response = await api<Recipe>(`/api/recipes/${id}`, {
          method: 'PUT',
          body: recipeData,
          timeout: OFFLINE_REQUEST_TIMEOUT_MS,
          silent: true,
        });
        this.pendingEdits = this.pendingEdits.filter((edit) => edit.recipeId !== id);
        this.conflicts = this.conflicts.filter((conflict) => conflict.recipeId !== id);
        this.persistPending();
        this.rememberServerRecipe(response);
        this.currentRecipe = response;
        return response;
      } catch (error) {
        if (isNetworkError(error)) {
          await this.queueRecipeEdit(id, startingBaseline, yours);
          return this.currentRecipe;
        }
        console.error('Error updating recipe:', error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async queueRecipeEdit(id: number, baseline: RecipeSyncValue, yours: RecipeSyncValue) {
      const familyId = this.familyId();
      if (!familyId) {
        return;
      }
      bumpRecipeFetches();
      const next = mergeRecipePendingEdit(this.pendingEdits, {
        recipeId: id,
        baseline,
        recipe: yours,
      });
      this.pendingEdits = next;
      writePendingEdits(familyId, next);
      const base = this.recipes.find((recipe) => recipe.id === id) ?? this.currentRecipe;
      if (base && base.id === id) {
        const shown = overlayRecipe(base, yours);
        this.recipes = replaceById(this.recipes, shown);
        this.currentRecipe = shown;
      }
    },

    persistPending() {
      const familyId = this.familyId();
      if (!familyId) {
        return;
      }
      writePendingEdits(familyId, this.pendingEdits);
    },

    async flushPending() {
      return enqueueRecipeFlush(() => this.executeFlush());
    },

    async executeFlush() {
      const familyId = this.familyId();
      if (!familyId || !this.browserIsOnline() || this.pendingEdits.length === 0) {
        return;
      }
      this.syncing = true;
      this.syncFailed = false;
      try {
        const { api } = useApi();
        for (const edit of [...this.pendingEdits]) {
          if (this.conflicts.some((conflict) => conflict.recipeId === edit.recipeId)) {
            continue;
          }
          const result = await api<{
            status: string;
            yours?: RecipeSyncValue;
            theirs?: RecipeSyncValue;
            baseline?: RecipeSyncValue;
            recipe?: Recipe | null;
          }>(`/api/recipes/${edit.recipeId}/sync`, {
            method: 'POST',
            silent: true,
            suppressPaywall: true,
            timeout: OFFLINE_REQUEST_TIMEOUT_MS,
            body: {
              baseline: edit.baseline,
              recipe: edit.recipe,
            },
          });
          this.consumeSyncResult(edit, result);
        }
      } catch (error) {
        const entitlementError = extractEntitlementError(error);
        if (entitlementError) {
          const { openPaywall } = usePaywall();
          openPaywall(entitlementError.feature as never);
          return;
        }
        if (!isNetworkError(error)) {
          this.syncFailed = true;
        }
      } finally {
        this.syncing = false;
        this.persistPending();
      }
    },

    consumeSyncResult(
      edit: RecipePendingEdit,
      result: {
        status: string;
        yours?: RecipeSyncValue;
        theirs?: RecipeSyncValue;
        baseline?: RecipeSyncValue;
        recipe?: Recipe | null;
      }
    ) {
      if (result.status === 'applied' || result.status === 'already_saved' || result.status === 'not_found') {
        this.pendingEdits = this.pendingEdits.filter((item) => item.recipeId !== edit.recipeId);
        this.conflicts = this.conflicts.filter((conflict) => conflict.recipeId !== edit.recipeId);
        if (result.recipe) {
          bumpRecipeFetches();
          this.rememberServerRecipe(result.recipe);
          if (this.currentRecipe?.id === result.recipe.id) {
            this.currentRecipe = result.recipe;
          }
        }
        return;
      }
      if (result.status === 'conflict' && result.yours && result.theirs && result.baseline) {
        const conflict: RecipeSyncConflict = {
          recipeId: edit.recipeId,
          yours: result.yours,
          theirs: result.theirs,
          baseline: result.baseline,
          serverRecipe: result.recipe,
        };
        this.conflicts = [
          ...this.conflicts.filter((item) => item.recipeId !== edit.recipeId),
          conflict,
        ];
      }
    },

    async keepMine(conflict: RecipeSyncConflict) {
      const familyId = this.familyId();
      if (!familyId) {
        return;
      }
      this.syncing = true;
      try {
        const { api } = useApi();
        const result = await api<{
          status: string;
          yours?: RecipeSyncValue;
          theirs?: RecipeSyncValue;
          baseline?: RecipeSyncValue;
          recipe?: Recipe | null;
        }>(`/api/recipes/${conflict.recipeId}/sync/resolve`, {
          method: 'POST',
          silent: true,
          suppressPaywall: true,
          timeout: OFFLINE_REQUEST_TIMEOUT_MS,
          body: {
            baseline: conflict.baseline,
            expected: conflict.theirs,
            recipe: conflict.yours,
          },
        });
        const edit = this.pendingEdits.find((item) => item.recipeId === conflict.recipeId) ?? {
          recipeId: conflict.recipeId,
          baseline: conflict.baseline,
          recipe: conflict.yours,
        };
        this.consumeSyncResult(edit, result);
      } catch (error) {
        const entitlementError = extractEntitlementError(error);
        if (entitlementError) {
          const { openPaywall } = usePaywall();
          openPaywall(entitlementError.feature as never);
          return;
        }
        if (!isNetworkError(error)) {
          this.syncFailed = true;
        }
      } finally {
        this.syncing = false;
        this.persistPending();
      }
    },

    keepTheirs(conflict: RecipeSyncConflict) {
      bumpRecipeFetches();
      this.pendingEdits = this.pendingEdits.filter((item) => item.recipeId !== conflict.recipeId);
      this.conflicts = this.conflicts.filter((item) => item.recipeId !== conflict.recipeId);
      if (conflict.serverRecipe) {
        this.rememberServerRecipe(conflict.serverRecipe);
        if (this.currentRecipe?.id === conflict.serverRecipe.id) {
          this.currentRecipe = conflict.serverRecipe;
        }
      } else {
        const base = this.recipes.find((recipe) => recipe.id === conflict.recipeId) ?? this.currentRecipe;
        if (base && base.id === conflict.recipeId) {
          const shown = overlayRecipe(base, conflict.theirs);
          this.recipes = replaceById(this.recipes, shown);
          this.currentRecipe = shown;
        }
      }
      this.persistPending();
    },

    async keepAllMine() {
      for (const conflict of [...this.conflicts]) {
        await this.keepMine(conflict);
      }
    },

    keepAllTheirs() {
      for (const conflict of [...this.conflicts]) {
        this.keepTheirs(conflict);
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
