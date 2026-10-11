export type MealType = 'breakfast' | 'lunch' | 'dinner';

export type LegacyMealKey = MealType;

export interface DayMealSlot {
  id: number;
  meal_slot_id: number;
  name: string;
  position: number;
  dish: string | null;
  recipe_id: number | null;
  legacy_key: LegacyMealKey | null;
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
  legacy_key: LegacyMealKey | null;
}

export interface SelectedMeal {
  type: MealType | null;
  mealSlotId: number | null;
  dayOfWeek: number | null;
  name: string;
  recipeId: number | null;
}

export interface SaveDailyMealPayload {
  week_start_date: string;
  day_of_week: number;
  breakfast: string;
  lunch: string;
  dinner: string;
  breakfast_recipe_id: number | null;
  lunch_recipe_id: number | null;
  dinner_recipe_id: number | null;
  slot_updates?: Array<{
    meal_slot_id: number;
    dish: string;
    recipe_id: number | null;
  }>;
}
