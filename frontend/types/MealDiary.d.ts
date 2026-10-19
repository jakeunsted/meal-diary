import type { MealDiarySlotValue } from '@meal-diary/shared';

export interface MealDiaryPendingSlot {
  family_group_id: number;
  week_start_date: string;
  day_of_week: number;
  meal_slot_id: number;
  baseline: MealDiarySlotValue;
  dish: string | null;
  recipe_id: number | null;
}

export interface MealDiarySyncConflict {
  week_start_date: string;
  day_of_week: number;
  meal_slot_id: number;
  slot_name: string;
  yours: MealDiarySlotValue;
  theirs: MealDiarySlotValue;
  baseline: MealDiarySlotValue;
}

export type MealDiarySyncEntitlement = 'edit_past_weeks' | 'weeks_ahead';

export interface DayMealSlot {
  id: number;
  meal_slot_id: number;
  name: string;
  position: number;
  dish: string | null;
  recipe_id: number | null;
  legacy_key: 'breakfast' | 'lunch' | 'dinner' | null;
}

export interface DailyMeal {
  day_of_week: number;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  breakfast_recipe_id: number | null;
  lunch_recipe_id: number | null;
  dinner_recipe_id: number | null;
  week_start_date: string;
  slots?: DayMealSlot[];
}

export interface MealSlotTemplate {
  id: number;
  name: string;
  position: number;
  legacy_key: 'breakfast' | 'lunch' | 'dinner' | null;
}

export interface MealDiaryState {
  weeklyMeals: DailyMeal[];
  loading: boolean;
  selectedMeal: {
    type: string | null;
    mealSlotId: number | null;
    dayOfWeek: number | null;
    name: string;
    recipeId: number | null;
  };
  eventSource: EventSource | null;
  currentWeekStart: string | null;
  lastFetchTime: number | null;
  lastFetchError: string | null;
  pendingSlots: MealDiaryPendingSlot[];
  syncFailed: boolean;
  syncEntitlementByWeek: Record<string, MealDiarySyncEntitlement>;
  conflicts: MealDiarySyncConflict[];
  reviewWeekStart: string | null;
  syncing: boolean;
}
