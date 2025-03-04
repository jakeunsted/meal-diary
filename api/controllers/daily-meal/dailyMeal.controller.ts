import type { Request, Response } from 'express';
import { DailyMeal } from '../../db/models/associations.ts';
import { Op } from 'sequelize';

// Create a new daily meal
export const createDailyMeal = async (req: Request, res: Response) => {
  try {
    const { meal_diary_id, day_of_week, breakfast, lunch, dinner } = req.body;

    // Validate required fields
    if (!meal_diary_id || !day_of_week) {
      return res.status(400).json({ message: 'Meal diary ID and day of week are required' });
    }

    // Create the daily meal
    const dailyMeal = await DailyMeal.create({
      meal_diary_id,
      day_of_week,
      breakfast,
      lunch,
      dinner
    });

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

    // Find daily meals by meal diary ID
    const dailyMeals = await DailyMeal.findAll({
      where: { meal_diary_id: parseInt(meal_diary_id) }
    });

    return res.status(200).json(dailyMeals);
  } catch (error) {
    console.error('Error getting daily meals:', error);
    return res.status(500).json({ message: 'Failed to get daily meals' });
  }
};
