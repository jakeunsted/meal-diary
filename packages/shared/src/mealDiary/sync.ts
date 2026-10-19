export interface MealDiarySlotValue {
  dish: string | null;
  recipe_id: number | null;
}

export interface MealDiarySyncSlot {
  day_of_week: number;
  meal_slot_id: number;
  baseline: MealDiarySlotValue;
  dish: string | null;
  recipe_id: number | null;
}

export interface MealDiarySyncRequest {
  week_start_date: string;
  slots: MealDiarySyncSlot[];
}

export type MealDiarySyncStatus =
  | 'applied'
  | 'already_saved'
  | 'conflict'
  | 'slot_removed'
  | 'recipe_rejected';

export interface MealDiarySyncResult {
  day_of_week: number;
  meal_slot_id: number;
  status: MealDiarySyncStatus;
  /** Present only when status is conflict. Dish is trimmed; a blank dish is null. */
  yours?: MealDiarySlotValue;
  /** Server value. Present only when status is conflict. */
  theirs?: MealDiarySlotValue;
  /** Submitted baseline. Present only when status is conflict. */
  baseline?: MealDiarySlotValue;
}

export interface MealDiaryResolveSlot {
  day_of_week: number;
  meal_slot_id: number;
  dish: string | null;
  recipe_id: number | null;
  expected: MealDiarySlotValue;
  baseline: MealDiarySlotValue;
}

export interface MealDiaryResolveRequest {
  week_start_date: string;
  keep_mine: MealDiaryResolveSlot[];
}

/** Trim a dish and treat a blank string as null. Non-strings are null. */
export const normalizeMealDiaryDish = (
  dish: string | null | undefined
): string | null => {
  if (typeof dish !== 'string') {
    return null;
  }
  const trimmed = dish.trim();
  return trimmed.length === 0 ? null : trimmed;
};

/**
 * Shared equality check for a diary slot.
 * Both dishes are normalized, then dish and recipe_id must both be equal.
 */
export const mealDiarySlotValuesMatch = (
  left: MealDiarySlotValue,
  right: MealDiarySlotValue
): boolean =>
  normalizeMealDiaryDish(left.dish) === normalizeMealDiaryDish(right.dish) &&
  (left.recipe_id ?? null) === (right.recipe_id ?? null);
