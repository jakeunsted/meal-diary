import type { RecipeCategoryNameErrorCode } from '@meal-diary/shared';

const RECIPE_CATEGORY_NAME_ERROR_KEYS: Record<RecipeCategoryNameErrorCode, string> = {
  empty: 'recipes.categories.nameEmpty',
  too_long: 'recipes.categories.nameTooLong',
  emoji: 'recipes.categories.nameInvalid',
  control_chars: 'recipes.categories.nameInvalid',
  duplicate: 'recipes.categories.nameDuplicate',
};

export function recipeCategoryNameErrorKey(code: string | undefined): string | null {
  if (code == null) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(RECIPE_CATEGORY_NAME_ERROR_KEYS, code)) {
    return RECIPE_CATEGORY_NAME_ERROR_KEYS[code as RecipeCategoryNameErrorCode];
  }

  return null;
}
