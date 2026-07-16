export interface ParsedRecipeIngredient {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

export interface ParsedRecipeDraft {
  name: string;
  description?: string;
  instructions?: string;
  portions?: number;
  ingredients: ParsedRecipeIngredient[];
}
