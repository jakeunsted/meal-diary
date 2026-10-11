import { MealDiary, DailyMeal } from '../db/models/associations.ts';
import {
  applySlotDishUpdates,
  buildDaySlotsForWeek,
  ensureDefaultMealSlots,
  syncLegacyColumnsToEntries,
  type DayMealSlotDto,
} from './mealSlots.service.ts';

/**
 * Interface representing a daily meal with day of week information
 */
export interface DailyMealWithDay {
  day_of_week: number;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  breakfast_recipe_id: number | null;
  lunch_recipe_id: number | null;
  dinner_recipe_id: number | null;
  slots: DayMealSlotDto[];
  week_start_date?: string;
}

const toDailyMealWithDay = (
  dayOfWeek: number,
  meal: {
    breakfast?: string | null;
    lunch?: string | null;
    dinner?: string | null;
    breakfast_recipe_id?: number | null;
    lunch_recipe_id?: number | null;
    dinner_recipe_id?: number | null;
  },
  slots: DayMealSlotDto[],
  weekStartDate?: string
): DailyMealWithDay => ({
  day_of_week: dayOfWeek,
  breakfast: meal.breakfast ?? null,
  lunch: meal.lunch ?? null,
  dinner: meal.dinner ?? null,
  breakfast_recipe_id: meal.breakfast_recipe_id ?? null,
  lunch_recipe_id: meal.lunch_recipe_id ?? null,
  dinner_recipe_id: meal.dinner_recipe_id ?? null,
  slots,
  ...(weekStartDate ? { week_start_date: weekStartDate } : {}),
});

/**
 * Creates a new weekly meal plan for a family group
 */
export const createNewWeeklyMeals = async (
  familyGroupId: number,
  weekStartDate: Date
): Promise<DailyMealWithDay[]> => {
  await ensureDefaultMealSlots(familyGroupId);

  const mealDiary = await MealDiary.create({
    family_group_id: familyGroupId,
    week_start_date: weekStartDate,
  });

  const rows = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStartDate);
    date.setDate(date.getDate() + index);
    const jsDay = date.getDay();
    return {
      meal_diary_id: mealDiary.dataValues.id,
      day_of_week: jsDay === 0 ? 7 : jsDay,
    };
  });

  const created = await DailyMeal.bulkCreate(rows, { ignoreDuplicates: true });
  const dayRows = created.map((meal) => ({
    id: meal.dataValues.id,
    day_of_week: meal.dataValues.day_of_week,
  }));

  // bulkCreate with ignoreDuplicates may skip rows — reload if needed
  const dayRowsForSlots =
    dayRows.length === 7
      ? dayRows
      : (
          await DailyMeal.findAll({
            where: { meal_diary_id: mealDiary.dataValues.id },
            attributes: ['id', 'day_of_week'],
            order: [['day_of_week', 'ASC']],
          })
        ).map((meal) => ({
          id: meal.dataValues.id,
          day_of_week: meal.dataValues.day_of_week,
        }));

  const slotsByDay = await buildDaySlotsForWeek(
    familyGroupId,
    weekStartDate,
    dayRowsForSlots
  );

  return Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    return toDailyMealWithDay(
      day,
      {
        breakfast: null,
        lunch: null,
        dinner: null,
        breakfast_recipe_id: null,
        lunch_recipe_id: null,
        dinner_recipe_id: null,
      },
      slotsByDay.get(day) ?? []
    );
  });
};

/**
 * Retrieves the weekly meal plan for a family group
 */
export const getWeeklyMeals = async (
  familyGroupId: number,
  weekStartDate: Date,
  today?: Date
): Promise<DailyMealWithDay[]> => {
  await ensureDefaultMealSlots(familyGroupId);

  const [mealDiary] = await MealDiary.findOrCreate({
    where: {
      family_group_id: familyGroupId,
      week_start_date: weekStartDate,
    },
    defaults: {
      family_group_id: familyGroupId,
      week_start_date: weekStartDate,
    },
  });

  const dailyMeals = await DailyMeal.findAll({
    where: { meal_diary_id: mealDiary.dataValues.id },
    attributes: [
      'id',
      'day_of_week',
      'breakfast',
      'lunch',
      'dinner',
      'breakfast_recipe_id',
      'lunch_recipe_id',
      'dinner_recipe_id',
    ],
    order: [['day_of_week', 'ASC']],
  });

  const existingMealsMap = new Map(
    dailyMeals.map((meal) => [meal.dataValues.day_of_week, meal])
  );

  // Ensure all 7 day rows exist for slot building
  for (let day = 1; day <= 7; day++) {
    if (!existingMealsMap.has(day)) {
      const [created] = await DailyMeal.findOrCreate({
        where: {
          meal_diary_id: mealDiary.dataValues.id,
          day_of_week: day,
        },
        defaults: {
          meal_diary_id: mealDiary.dataValues.id,
          day_of_week: day,
        },
      });
      existingMealsMap.set(day, created);
    }
  }

  const dayRows = Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    const meal = existingMealsMap.get(day)!;
    return { id: meal.dataValues.id, day_of_week: day };
  });

  const slotsByDay = await buildDaySlotsForWeek(
    familyGroupId,
    weekStartDate,
    dayRows,
    today
  );

  const weeklyMeals: DailyMealWithDay[] = [];
  for (let day = 1; day <= 7; day++) {
    const existingMeal = existingMealsMap.get(day)!;
    weeklyMeals.push(
      toDailyMealWithDay(day, existingMeal.dataValues, slotsByDay.get(day) ?? [])
    );
  }

  return weeklyMeals;
};

/**
 * Updates a specific daily meal in a family's weekly meal plan
 */
export const updateDailyMeal = async (
  familyGroupId: number,
  weekStartDate: Date,
  dayOfWeek: number,
  updates: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    breakfast_recipe_id?: number | null;
    lunch_recipe_id?: number | null;
    dinner_recipe_id?: number | null;
  }
): Promise<DailyMeal> => {
  const mealDiary = await MealDiary.findOne({
    where: {
      family_group_id: familyGroupId,
      week_start_date: weekStartDate,
    },
    attributes: ['id'],
  });

  if (!mealDiary) {
    throw new Error('Meal diary not found for this week');
  }

  const [dailyMeal] = await DailyMeal.findOrCreate({
    where: {
      meal_diary_id: mealDiary.dataValues.id,
      day_of_week: dayOfWeek,
    },
    defaults: {
      meal_diary_id: mealDiary.dataValues.id,
      day_of_week: dayOfWeek,
    },
  });

  const recipeIdKeys = new Set([
    'breakfast_recipe_id',
    'lunch_recipe_id',
    'dinner_recipe_id',
  ]);

  const sanitizedUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      continue;
    }
    if (value === null && recipeIdKeys.has(key)) {
      sanitizedUpdates[key] = null;
      continue;
    }
    sanitizedUpdates[key] = value === null ? undefined : value;
  }

  await dailyMeal.update(sanitizedUpdates);

  await syncLegacyColumnsToEntries(familyGroupId, dailyMeal.dataValues.id, updates);

  return dailyMeal;
};

/** Apply optional slot dish updates and return the day shaped like GET weekly meals. */
export const updateDailyMealWithSlots = async (
  familyGroupId: number,
  weekStartDate: Date,
  dayOfWeek: number,
  legacyUpdates: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    breakfast_recipe_id?: number | null;
    lunch_recipe_id?: number | null;
    dinner_recipe_id?: number | null;
  },
  slotUpdates?: Array<{
    meal_slot_id: number;
    dish?: string | null;
    recipe_id?: number | null;
  }>,
  weekStartDateStr?: string
): Promise<{ meal: DailyMeal; response: DailyMealWithDay }> => {
  const updatedMeal = await updateDailyMeal(
    familyGroupId,
    weekStartDate,
    dayOfWeek,
    legacyUpdates
  );

  if (Array.isArray(slotUpdates) && slotUpdates.length > 0) {
    await applySlotDishUpdates(familyGroupId, updatedMeal.dataValues.id, slotUpdates);
    await updatedMeal.reload();
  }

  const slotsByDay = await buildDaySlotsForWeek(
    familyGroupId,
    weekStartDate,
    [{ id: updatedMeal.dataValues.id, day_of_week: dayOfWeek }]
  );

  return {
    meal: updatedMeal,
    response: toDailyMealWithDay(
      dayOfWeek,
      updatedMeal.dataValues,
      slotsByDay.get(dayOfWeek) ?? [],
      weekStartDateStr
    ),
  };
};
