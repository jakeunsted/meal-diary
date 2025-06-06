export interface DailyMeal {
  day_of_week: number;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  week_start_date: string;
}

export interface MealDiaryState {
  weeklyMeals: DailyMeal[];
  loading: boolean;
  selectedMeal: {
    type: string | null;
    dayOfWeek: number | null;
    name: string;
  };
  eventSource: EventSource | null;
  currentWeekStart: string | null;
  lastFetchTime: number | null;
}