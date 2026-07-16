export interface RecipeIngredient {
  id?: number;
  name: string;
  quantity?: number | null;
  unit?: string | null;
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
  created_at?: string;
  updated_at?: string;
}

export interface CreateRecipePayload {
  name: string;
  description?: string;
  instructions?: string;
  portions?: number;
  ingredients?: RecipeIngredient[];
}

export interface ImportRecipeFromUrlPayload {
  url: string;
}

export interface UpdateRecipePayload {
  name?: string;
  description?: string;
  instructions?: string;
  portions?: number;
  ingredients?: RecipeIngredient[];
}
