import express from 'express';
import * as dailyMealController from '../controllers/daily-meal/dailyMeal.controller.ts';

const router = express.Router();

// Get daily meals by meal diary id
router.get('/:meal_diary_id', async (req, res, next) => {
  try {
    await dailyMealController.getDailyMealsByMealDiaryId(req, res);
  } catch (error) {
    next(error);
  }
});

// Update daily meal by id
router.put('/:id', async (req, res, next) => {
  try {
    await dailyMealController.updateDailyMealById(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;