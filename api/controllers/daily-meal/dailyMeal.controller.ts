import type { Request, Response } from 'express';
import { User } from '../../db/models/associations.ts';
import * as DailyMealService from '../../services/dailyMeal.service.ts';

// Create a new daily meal
export const createDailyMeal = async (req: Request, res: Response) => {
  try {
    const { meal_diary_id, day_of_week, breakfast, lunch, dinner } = req.body;
    const user = req.user as User;

    // Validate required fields
    if (!meal_diary_id || !day_of_week) {
      return res.status(400).json({ message: 'Meal diary ID and day of week are required' });
    }

    const dailyMeal = await DailyMealService.createDailyMealEntry(
      meal_diary_id,
      day_of_week,
      breakfast,
      lunch, 
      dinner, 
      user
    );

    return res.status(201).json(dailyMeal);
  } catch (error) {
    console.error('Error creating daily meal:', error);
    return res.status(500).json({ message: 'Failed to create daily meal' });
  }
};

// get all daily meals by meal diary id
export const getDailyMealsByMealDiaryId = async (req: Request, res: Response) => {
  try {
    const { meal_diary_id } = req.params;

    // Validate meal diary ID
    if (!meal_diary_id) {
      return res.status(400).json({ message: 'Meal diary ID is required' });
    }

    // Get daily meals by meal diary ID
    const dailyMeals = await DailyMealService.getDailyMealsByMealDiaryId(parseInt(meal_diary_id));
    return res.status(200).json(dailyMeals);
  } catch (error) {
    console.error('Error getting daily meals:', error);
    return res.status(500).json({ message: 'Failed to get daily meals' });
  }
};

// update a daily meal by id
export const updateDailyMealById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { breakfast = null, lunch = null, dinner = null } = req.body;

    const dailyMeal = await DailyMealService.updateDailyMealById(parseInt(id), breakfast, lunch, dinner, req.user as User);

    return res.status(200).json(dailyMeal);
  } catch (error) {
    console.error('Error updating daily meal:', error);
    return res.status(500).json({ message: 'Failed to update daily meal' });
  }
};
