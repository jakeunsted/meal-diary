import {
  normalizeMealDiaryDish,
  type MealDiarySlotValue,
} from '@meal-diary/shared';
import type { DailyMeal, MealDiaryPendingSlot } from '~/types/MealDiary';

export const MEAL_DIARY_PENDING_KEY = 'mealDiaryPending';

type LegacyKey = 'breakfast' | 'lunch' | 'dinner';

const isLegacyKey = (value: string | null | undefined): value is LegacyKey =>
  value === 'breakfast' || value === 'lunch' || value === 'dinner';

export const slotValue = (
  dish: string | null | undefined,
  recipeId: number | null | undefined
): MealDiarySlotValue => ({
  dish: normalizeMealDiaryDish(dish),
  recipe_id: recipeId ?? null,
});

export const isMealDiaryPendingSlot = (value: unknown): value is MealDiaryPendingSlot => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const slot = value as MealDiaryPendingSlot;
  return (
    typeof slot.family_group_id === 'number' &&
    typeof slot.week_start_date === 'string' &&
    typeof slot.day_of_week === 'number' &&
    typeof slot.meal_slot_id === 'number' &&
    !!slot.baseline &&
    typeof slot.baseline === 'object'
  );
};

export const normalizePendingSlot = (slot: MealDiaryPendingSlot): MealDiaryPendingSlot => ({
  family_group_id: slot.family_group_id,
  week_start_date: slot.week_start_date,
  day_of_week: slot.day_of_week,
  meal_slot_id: slot.meal_slot_id,
  baseline: slotValue(slot.baseline?.dish, slot.baseline?.recipe_id),
  dish: normalizeMealDiaryDish(slot.dish),
  recipe_id: slot.recipe_id ?? null,
});

/** Copy legacy breakfast/lunch/dinner columns from slot rows that carry a legacy key. */
export const applyLegacyColumnsFromSlots = (day: DailyMeal): DailyMeal => {
  if (!day.slots?.length) {
    return day;
  }
  const next: DailyMeal = { ...day, slots: day.slots };
  for (const slot of next.slots ?? []) {
    if (!isLegacyKey(slot.legacy_key)) {
      continue;
    }
    next[slot.legacy_key] = slot.dish;
    next[`${slot.legacy_key}_recipe_id`] = slot.recipe_id;
  }
  return next;
};

export const writeSlotValue = (
  day: DailyMeal,
  mealSlotId: number,
  value: MealDiarySlotValue
): void => {
  const slot = day.slots?.find((entry) => entry.meal_slot_id === mealSlotId);
  if (!slot) {
    return;
  }
  slot.dish = value.dish;
  slot.recipe_id = value.recipe_id;
  if (isLegacyKey(slot.legacy_key)) {
    day[slot.legacy_key] = value.dish;
    day[`${slot.legacy_key}_recipe_id`] = value.recipe_id;
  }
};

export const readSlotValue = (
  day: DailyMeal | undefined,
  mealSlotId: number,
  legacyType: string | null
): MealDiarySlotValue => {
  const slot = day?.slots?.find((entry) => entry.meal_slot_id === mealSlotId);
  if (slot) {
    return slotValue(slot.dish, slot.recipe_id);
  }
  if (isLegacyKey(legacyType) && day) {
    return slotValue(day[legacyType], day[`${legacyType}_recipe_id`]);
  }
  return slotValue(null, null);
};

export const cloneServerWeek = (weekStartDate: string, days: DailyMeal[]): DailyMeal[] =>
  days.map((day) => ({
    ...day,
    week_start_date: weekStartDate,
    slots: (day.slots ?? []).map((slot) => ({ ...slot })),
  }));

export const restorePendingLegacyColumns = (
  day: DailyMeal,
  isPending: (mealSlotId: number) => boolean
): DailyMeal => {
  const slots = day.slots;
  if (!slots?.length) {
    return day;
  }
  const next: DailyMeal = { ...day, slots };
  for (const slot of slots) {
    if (!isPending(slot.meal_slot_id) || !isLegacyKey(slot.legacy_key)) {
      continue;
    }
    next[slot.legacy_key] = slot.dish;
    next[`${slot.legacy_key}_recipe_id`] = slot.recipe_id;
  }
  return next;
};
