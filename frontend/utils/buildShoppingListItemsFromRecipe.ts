import { categorizeShoppingItemName } from '@meal-diary/shared';
import type { RecipeIngredient } from '~/types/Recipe';

export interface ShoppingListBulkItemPayload {
  name: string;
  category: string;
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
  return ingredients.map((ingredient) => {
    const name = formatIngredientShoppingListName(ingredient);
    return {
      name,
      category: categorizeShoppingItemName(name),
    };
  });
}
