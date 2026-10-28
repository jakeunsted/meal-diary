import { MAX_MEAL_SLOT_NAME_LENGTH } from '../mealSlots/constants.ts';

export const MAX_RECIPE_CATEGORY_NAME_LENGTH = MAX_MEAL_SLOT_NAME_LENGTH;

export const RECIPE_CATEGORY_STARTER_KEYS = ['breakfast', 'lunch', 'dinner', 'dessert'] as const;

export type RecipeCategoryStarterKey = (typeof RECIPE_CATEGORY_STARTER_KEYS)[number];

export const DEFAULT_RECIPE_CATEGORIES: readonly {
  key: RecipeCategoryStarterKey;
  name: string;
}[] = [
  { key: 'breakfast', name: 'Breakfast' },
  { key: 'lunch', name: 'Lunch' },
  { key: 'dinner', name: 'Dinner' },
  { key: 'dessert', name: 'Dessert' },
];
