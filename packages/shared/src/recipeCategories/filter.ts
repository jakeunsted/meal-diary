export type RecipeCategoryFilter =
  | { kind: 'all' }
  | { kind: 'uncategorized' }
  | { kind: 'category'; categoryId: number };

export interface RecipeCategoryRef {
  id: number;
  assignable?: boolean;
}

export interface RecipeForCategoryFilter {
  categories: readonly RecipeCategoryRef[];
}

export interface RecipeCategoryTabCounts {
  all: number;
  uncategorized: number;
  byId: Record<number, number>;
}

export const recipeMatchesCategoryFilter = (
  recipe: RecipeForCategoryFilter,
  filter: RecipeCategoryFilter
): boolean => {
  if (filter.kind === 'all') {
    return true;
  }
  if (filter.kind === 'uncategorized') {
    return recipe.categories.length === 0;
  }
  return recipe.categories.some((category) => category.id === filter.categoryId);
};

/**
 * Count the loaded recipe list before name search and before the selected tab.
 * A recipe with only hidden (`assignable: false`) categories is in All, is not
 * Uncategorized, and does not increment a starter it does not have.
 */
export const countRecipesForCategoryTabs = (
  recipes: readonly RecipeForCategoryFilter[],
  visibleCategories: readonly RecipeCategoryRef[]
): RecipeCategoryTabCounts => {
  const byId: Record<number, number> = {};
  for (const category of visibleCategories) {
    byId[category.id] = 0;
  }

  let uncategorized = 0;
  for (const recipe of recipes) {
    if (recipe.categories.length === 0) {
      uncategorized += 1;
    }
    for (const category of recipe.categories) {
      if (category.id in byId) {
        byId[category.id] += 1;
      }
    }
  }

  return {
    all: recipes.length,
    uncategorized,
    byId,
  };
};
