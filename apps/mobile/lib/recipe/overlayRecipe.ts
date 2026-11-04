import { overlayRecipe, type RecipeSyncValue } from '@meal-diary/shared';

import type { Recipe } from '@/types/recipe';

export function overlayRecipeList(
  recipes: Recipe[],
  edits: { recipeId: number; recipe: RecipeSyncValue }[]
): Recipe[] {
  if (edits.length === 0) {
    return recipes;
  }
  return recipes.map((recipe) => {
    const edit = edits.find((item) => item.recipeId === recipe.id);
    return edit ? overlayRecipe(recipe, edit.recipe) : recipe;
  });
}
