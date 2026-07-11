export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface DailyMeal {
  day_of_week: number;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  breakfast_recipe_id: number | null;
  lunch_recipe_id: number | null;
  dinner_recipe_id: number | null;
  week_start_date: string;
}

export interface SelectedMeal {
  type: MealType | null;
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
}
