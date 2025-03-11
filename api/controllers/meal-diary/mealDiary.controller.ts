import type { Request, Response } from 'express';
import { MealDiary, DailyMeal } from '../../db/models/associations.ts';
import { createNewWeeklyMeals, getWeeklyMeals, updateDailyMeal } from './mealDiary.service.ts';

// Create a new meal diary
export const createMealDiary = async (req: Request, res: Response) => {
  try {
    const { family_group_id, week_start_date } = req.body;

    // Validate required fields
    if (!family_group_id || !week_start_date) {
      return res.status(400).json({ message: 'Family group ID and week start date are required' });
    }

    // Create the meal diary
    const mealDiary = await MealDiary.create({
      family_group_id,
      week_start_date,
    });

    return res.status(201).json(mealDiary);
  } catch (error) {
    console.error('Error creating meal diary:', error);
    return res.status(500).json({ message: 'Failed to create meal diary' });
  }
};

// Get meal diary by family group ID
export const getMealDiaryByFamilyGroupId = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;

    // Validate family group ID
    if (!family_group_id) {
      return res.status(400).json({ message: 'Family group ID is required' });
    }

    // Find meal diary by family group ID
    let mealDiary = await MealDiary.findOne({
      where: { family_group_id: parseInt(family_group_id) }
    });

    // if no meal diary, create a new one
    if (!mealDiary) {
      // get monday of current week
      const monday = new Date();
      monday.setDate(monday.getDate() - (monday.getDay() || 7) + 1);
      mealDiary = await MealDiary.create({
        family_group_id: parseInt(family_group_id),
        week_start_date: monday
      });
    }

    return res.status(200).json(mealDiary);
  } catch (error) {
    console.error('Error getting meal diary:', error);
    return res.status(500).json({ message: 'Failed to get meal diary' });
  }
};

// Get weekly meals for a family group
export const getWeeklyMealsForFamilyGroup = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;
    const { week_start_date } = req.query;

    if (!family_group_id || !week_start_date) {
      return res.status(400).json({ message: 'Family group ID and week start date are required' });
    }

    let weeklyMeals = await getWeeklyMeals(
      parseInt(family_group_id),
      new Date(week_start_date as string)
    );

    // if no weekly meals yet, create the diary and return empty meals
    if (!weeklyMeals) {
      weeklyMeals = await createNewWeeklyMeals(
        parseInt(family_group_id),
        new Date(week_start_date as string)
      );
    }

    return res.status(200).json(weeklyMeals);
  } catch (error) {
    console.error('Error getting weekly meals:', error);
    return res.status(500).json({ message: 'Failed to get weekly meals' });
  }
};

// Update a daily meal
export const updateDailyMealForFamilyGroup = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;
    const { week_start_date, day_of_week, breakfast = '', lunch = '', dinner = '' } = req.body;

    if (!family_group_id || !week_start_date || !day_of_week) {
      return res.status(400).json({ 
        message: 'Family group ID, week start date, and day of week are required' 
      });
    }

    const updatedMeal = await updateDailyMeal(
      parseInt(family_group_id),
      new Date(week_start_date),
      parseInt(day_of_week),
      { breakfast, lunch, dinner }
    );

    return res.status(200).json(updatedMeal);
  } catch (error) {
    console.error('Error updating daily meal:', error);
    return res.status(500).json({ message: 'Failed to update daily meal' });
  }
};
