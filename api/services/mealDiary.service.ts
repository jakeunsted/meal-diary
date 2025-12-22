import { MealDiary, DailyMeal } from '../db/models/associations.ts';
import { Op } from 'sequelize';

/**
 * Interface representing a daily meal with day of week information
 */
interface DailyMealWithDay {
  day_of_week: number;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
}

/**
 * Creates a new weekly meal plan for a family group
 * @param familyGroupId - The ID of the family group
 * @param weekStartDate - The start date of the week for the meal plan
 * @returns {Promise<DailyMealWithDay[]>} An array of daily meals with day of week information
 */
export const createNewWeeklyMeals = async (familyGroupId: number, weekStartDate: Date): Promise<DailyMealWithDay[]> => {
  // Create an array of 7 days starting from weekStartDate
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStartDate);
    date.setDate(date.getDate() + index);
    return {
      date: date,
      breakfast: '',
      lunch: '',
      dinner: '',
    };
  });

  const mealDiary = await MealDiary.create({
    family_group_id: familyGroupId,
    week_start_date: weekStartDate
  });

  for (const day of days) {
    const dayOfWeek = day.date.getDay();
    // Convert JavaScript day (0-6, Sunday=0) to our format (1-7, Monday=1, Sunday=7)
    const normalizedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
    await DailyMeal.create({
      meal_diary_id: mealDiary.dataValues.id,
      day_of_week: normalizedDayOfWeek,
      breakfast: day.breakfast || '',
      lunch: day.lunch || '',
      dinner: day.dinner || ''
    });
  }

  const weeklyMeals: DailyMealWithDay[] = [];
  for (let day = 1; day <= 7; day++) {
    weeklyMeals.push({
      day_of_week: day,
      breakfast: '',
      lunch: '',
      dinner: ''
    });
  }

  return weeklyMeals;
};

/**
 * Retrieves the weekly meal plan for a family group
 * @param familyGroupId - The ID of the family group
 * @param weekStartDate - The start date of the week for the meal plan
 * @returns {Promise<DailyMealWithDay[]>} An array of daily meals with day of week information
 * @throws {Error} If the meal diary for the specified week is not found
 */
export const getWeeklyMeals = async (familyGroupId: number, weekStartDate: Date): Promise<DailyMealWithDay[]> => {
  // First, find or create the meal diary for this week
  const [mealDiary] = await MealDiary.findOrCreate({
    where: {
      family_group_id: familyGroupId,
      week_start_date: weekStartDate
    },
    defaults: {
      family_group_id: familyGroupId,
      week_start_date: weekStartDate
    }
  });

  // Get all daily meals for this week
  const dailyMeals = await DailyMeal.findAll({
    where: { meal_diary_id: mealDiary.dataValues.id },
    attributes: ['day_of_week', 'breakfast', 'lunch', 'dinner'],
    order: [['day_of_week', 'ASC']]
  });
  
  // Create a map of existing daily meals
  const existingMealsMap = new Map(
    dailyMeals.map(meal => [meal.dataValues.day_of_week, meal])
  );

  // Create an array of all 7 days, with existing meals or null values
  const weeklyMeals: DailyMealWithDay[] = [];
  for (let day = 1; day <= 7; day++) {
    const existingMeal = existingMealsMap.get(day);
    weeklyMeals.push({
      day_of_week: day,
      breakfast: existingMeal?.dataValues.breakfast || null,
      lunch: existingMeal?.dataValues.lunch || null,
      dinner: existingMeal?.dataValues.dinner || null
    });
  }

  return weeklyMeals;
};

/**
 * Updates a specific daily meal in a family's weekly meal plan
 * @param familyGroupId - The ID of the family group
 * @param weekStartDate - The start date of the week for the meal plan
 * @param dayOfWeek - The day of the week to update (1-7)
 * @param updates - Object containing the meal updates (breakfast, lunch, dinner)
 * @returns {Promise<DailyMeal>} The updated DailyMeal
 * @throws {Error} If the meal diary for the specified week is not found
 */
export const updateDailyMeal = async (
  familyGroupId: number,
  weekStartDate: Date,
  dayOfWeek: number,
  updates: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
  }
): Promise<DailyMeal> => {
  // Find the meal diary for this week
  const mealDiary = await MealDiary.findOne({
    where: {
      family_group_id: familyGroupId,
      week_start_date: weekStartDate
    },
    attributes: ['id']
  });

  if (!mealDiary) {
    throw new Error('Meal diary not found for this week');
  }

  // Find or create the daily meal
  const [dailyMeal] = await DailyMeal.findOrCreate({
    where: {
      meal_diary_id: mealDiary.dataValues.id,
      day_of_week: dayOfWeek
    },
    defaults: {
      meal_diary_id: mealDiary.dataValues.id,
      day_of_week: dayOfWeek
    }
  });

  // Update the daily meal
  await dailyMeal.update(updates);

  return dailyMeal;
};