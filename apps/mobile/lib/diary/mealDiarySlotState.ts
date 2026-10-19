import type { MealDiaryPendingSlot } from '@/lib/diary/mealDiaryPendingQueue';
import type { DailyMeal, DayMealSlot, MealType } from '@/types/mealDiary';

function withLegacyDish(
  day: DailyMeal,
  legacyKey: MealType,
  dish: string | null,
  recipeId: number | null
): DailyMeal {
  return {
    ...day,
    [legacyKey]: dish,
    [`${legacyKey}_recipe_id`]: recipeId,
  };
}

function legacyDish(day: DailyMeal, legacyKey: MealType): string | null {
  return day[legacyKey] ?? null;
}

function legacyRecipe(day: DailyMeal, legacyKey: MealType): number | null {
  return day[`${legacyKey}_recipe_id`] ?? null;
}

function applyPendingToDay(day: DailyMeal, pendingSlots: MealDiaryPendingSlot[]): DailyMeal {
  const pendingById = new Map(pendingSlots.map((slot) => [slot.meal_slot_id, slot]));
  const slots = (day.slots ?? []).map((slot) => {
    const pending = pendingById.get(slot.meal_slot_id);
    if (!pending) {
      return slot;
    }
    return {
      ...slot,
      dish: pending.dish,
      recipe_id: pending.recipe_id,
    };
  });

  let next: DailyMeal = { ...day, slots };
  for (const slot of slots) {
    const pending = pendingById.get(slot.meal_slot_id);
    if (!pending || !slot.legacy_key) {
      continue;
    }
    next = withLegacyDish(next, slot.legacy_key, pending.dish, pending.recipe_id);
  }
  return next;
}

export function overlayPendingSlots(
  meals: DailyMeal[],
  weekKey: string,
  pending: MealDiaryPendingSlot[]
): DailyMeal[] {
  const weekPending = pending.filter((slot) => slot.week_start_date === weekKey);
  return meals.map((meal) => {
    const dayPending = weekPending.filter((slot) => slot.day_of_week === meal.day_of_week);
    const withWeek = { ...meal, week_start_date: weekKey };
    if (dayPending.length === 0) {
      return withWeek;
    }
    return applyPendingToDay(withWeek, dayPending);
  });
}

export function applyLocalSlotValue(
  meals: DailyMeal[],
  weekKey: string,
  dayOfWeek: number,
  mealSlotId: number,
  mealType: MealType | null,
  dish: string | null,
  recipeId: number | null
): DailyMeal[] {
  const pending: MealDiaryPendingSlot = {
    week_start_date: weekKey,
    day_of_week: dayOfWeek,
    meal_slot_id: mealSlotId,
    baseline: { dish: null, recipe_id: null },
    dish,
    recipe_id: recipeId,
  };
  const index = meals.findIndex((meal) => meal.day_of_week === dayOfWeek);
  const existing = index === -1 ? undefined : meals[index];
  let day = applyPendingToDay(
    existing ?? {
      day_of_week: dayOfWeek,
      breakfast: null,
      lunch: null,
      dinner: null,
      breakfast_recipe_id: null,
      lunch_recipe_id: null,
      dinner_recipe_id: null,
      week_start_date: weekKey,
      slots: [],
    },
    [pending]
  );
  if (mealType) {
    day = withLegacyDish(day, mealType, dish, recipeId);
  }
  day = { ...day, week_start_date: weekKey };

  if (index === -1) {
    return [...meals, day];
  }
  const next = [...meals];
  next[index] = day;
  return next;
}

function copyServerSlotOntoDay(
  day: DailyMeal,
  serverDay: DailyMeal,
  mealSlotId: number
): DailyMeal {
  const serverSlot = serverDay.slots?.find((slot) => slot.meal_slot_id === mealSlotId);
  let slots = (day.slots ?? []).map((slot) =>
    slot.meal_slot_id === mealSlotId && serverSlot ? { ...serverSlot } : slot
  );
  if (serverSlot && !slots.some((slot) => slot.meal_slot_id === mealSlotId)) {
    slots = [...slots, { ...serverSlot }];
  }

  let next: DailyMeal = {
    ...day,
    week_start_date: serverDay.week_start_date || day.week_start_date,
    slots,
  };
  if (serverSlot?.legacy_key) {
    next = withLegacyDish(
      next,
      serverSlot.legacy_key,
      legacyDish(serverDay, serverSlot.legacy_key),
      legacyRecipe(serverDay, serverSlot.legacy_key)
    );
  }
  return next;
}

export function restoreSkippedSlots(
  currentMeals: DailyMeal[] | undefined,
  serverMeals: DailyMeal[],
  weekKey: string,
  skipped: Array<{ day_of_week: number; meal_slot_id: number }>,
  remainingPending: MealDiaryPendingSlot[]
): DailyMeal[] {
  const baseSource = currentMeals && currentMeals.length > 0 ? currentMeals : serverMeals;
  const serverByDay = new Map(serverMeals.map((meal) => [meal.day_of_week, meal]));
  let next = baseSource.map((meal) => ({ ...meal, week_start_date: weekKey }));

  for (const slot of skipped) {
    const serverDay = serverByDay.get(slot.day_of_week);
    if (!serverDay) {
      continue;
    }
    next = next.map((day) =>
      day.day_of_week === slot.day_of_week
        ? copyServerSlotOntoDay(day, { ...serverDay, week_start_date: weekKey }, slot.meal_slot_id)
        : day
    );
  }

  return overlayPendingSlots(next, weekKey, remainingPending);
}

export interface RealtimeDailyMeal {
  day_of_week: number;
  breakfast?: string | null;
  lunch?: string | null;
  dinner?: string | null;
  breakfast_recipe_id?: number | null;
  lunch_recipe_id?: number | null;
  dinner_recipe_id?: number | null;
  week_start_date?: string;
  slots?: DayMealSlot[];
}

/**
 * Event slots replace that day, except a pending slot keeps the local dish and recipe.
 */
export function mergeRealtimeDailyMeal(
  previous: DailyMeal,
  incoming: RealtimeDailyMeal,
  pendingSlots: MealDiaryPendingSlot[],
  weekKey: string
): DailyMeal {
  const dayPending = pendingSlots.filter(
    (slot) => slot.week_start_date === weekKey && slot.day_of_week === incoming.day_of_week
  );
  const pendingById = new Map(dayPending.map((slot) => [slot.meal_slot_id, slot]));
  const sourceSlots = incoming.slots ?? previous.slots ?? [];
  const slots = sourceSlots.map((slot) => {
    const pending = pendingById.get(slot.meal_slot_id);
    if (!pending) {
      return slot;
    }
    return {
      ...slot,
      dish: pending.dish,
      recipe_id: pending.recipe_id,
    };
  });

  const knownIds = new Set(slots.map((slot) => slot.meal_slot_id));
  for (const pending of dayPending) {
    if (knownIds.has(pending.meal_slot_id)) {
      continue;
    }
    const previousSlot = previous.slots?.find(
      (slot) => slot.meal_slot_id === pending.meal_slot_id
    );
    if (!previousSlot) {
      continue;
    }
    slots.push({
      ...previousSlot,
      dish: pending.dish,
      recipe_id: pending.recipe_id,
    });
  }

  slots.sort((left, right) => left.position - right.position);

  let next: DailyMeal = {
    ...previous,
    day_of_week: incoming.day_of_week,
    breakfast: incoming.breakfast ?? null,
    lunch: incoming.lunch ?? null,
    dinner: incoming.dinner ?? null,
    breakfast_recipe_id:
      incoming.breakfast_recipe_id !== undefined
        ? incoming.breakfast_recipe_id
        : previous.breakfast_recipe_id,
    lunch_recipe_id:
      incoming.lunch_recipe_id !== undefined
        ? incoming.lunch_recipe_id
        : previous.lunch_recipe_id,
    dinner_recipe_id:
      incoming.dinner_recipe_id !== undefined
        ? incoming.dinner_recipe_id
        : previous.dinner_recipe_id,
    week_start_date: weekKey,
    slots,
  };

  for (const slot of slots) {
    const pending = pendingById.get(slot.meal_slot_id);
    if (!pending || !slot.legacy_key) {
      continue;
    }
    next = withLegacyDish(next, slot.legacy_key, pending.dish, pending.recipe_id);
  }

  return next;
}
