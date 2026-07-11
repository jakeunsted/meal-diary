import type { RecipeIngredient } from '@/types/recipe';

export interface ShoppingListBulkItemPayload {
  name: string;
  parent_item_id: null;
}

function formatIngredientShoppingListName(ingredient: RecipeIngredient): string {
  if (ingredient.quantity && ingredient.unit) {
    return `${ingredient.name} (${ingredient.quantity} ${ingredient.unit})`;
  }
  if (ingredient.quantity) {
    return `${ingredient.name} (${ingredient.quantity})`;
  }
  return ingredient.name;
}

export function buildShoppingListItemsFromRecipe(
  ingredients: RecipeIngredient[]
): ShoppingListBulkItemPayload[] {
  return ingredients.map((ingredient) => ({
    name: formatIngredientShoppingListName(ingredient),
    parent_item_id: null,
  }));
}
