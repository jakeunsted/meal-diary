export const MIN_MEAL_SLOTS = 1;
export const MAX_MEAL_SLOTS = 6;
export const MAX_MEAL_SLOT_NAME_LENGTH = 32;

/** Presets shown in the Daily meals QUICK ADD chip row (excludes default meals). */
export const MEAL_SLOT_QUICK_ADD_PRESETS = ['Brunch', 'Snack', 'Post-workout'] as const;

export type MealSlotQuickAddPreset = (typeof MEAL_SLOT_QUICK_ADD_PRESETS)[number];

export const DEFAULT_MEAL_SLOT_NAMES = ['Breakfast', 'Lunch', 'Dinner'] as const;

export type LegacyMealKey = 'breakfast' | 'lunch' | 'dinner';

export const DEFAULT_LEGACY_MEAL_KEYS: readonly LegacyMealKey[] = [
  'breakfast',
  'lunch',
  'dinner',
];

export const isLegacyMealKey = (value: string): value is LegacyMealKey =>
  value === 'breakfast' || value === 'lunch' || value === 'dinner';
