import type { RecipeCategoryStarterKey, RecipeSyncValue } from '@meal-diary/shared';

export interface RecipeIngredient {
  id?: number;
  recipe_id?: number;
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

export interface RecipeCategory {
  id: number;
  family_group_id?: number;
  name: string;
  is_default: boolean;
  default_key: RecipeCategoryStarterKey | null;
  assignable: boolean;
}

export interface Recipe {
  id: number;
  family_group_id: number;
  created_by: number;
  name: string;
  description?: string | null;
  instructions?: string | null;
  portions?: number | null;
  ingredients?: RecipeIngredient[];
  categories?: RecipeCategory[];
  created_at?: string;
  updated_at?: string;
}

export interface RecipePendingEdit {
  recipeId: number;
  baseline: RecipeSyncValue;
  recipe: RecipeSyncValue;
}

export interface RecipeSyncConflict {
  recipeId: number;
  yours: RecipeSyncValue;
  theirs: RecipeSyncValue;
  baseline: RecipeSyncValue;
  serverRecipe?: Recipe | null;
}

export interface RecipeState {
  recipes: Recipe[];
  categories: RecipeCategory[];
  currentRecipe: Recipe | null;
  loading: boolean;
  saving: boolean;
  refreshing: boolean;
  loadError: boolean;
  searchQuery: string;
  pendingEdits: RecipePendingEdit[];
  conflicts: RecipeSyncConflict[];
  syncing: boolean;
  syncFailed: boolean;
}

export interface ImportRecipeFromUrlPayload {
  url: string;
}
