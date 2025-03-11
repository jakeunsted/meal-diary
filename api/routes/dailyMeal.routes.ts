import express from 'express';
import * as dailyMealController from '../controllers/daily-meal/dailyMeal.controller.ts';

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     DailyMeal:
 *       type: object
 *       required:
 *         - meal_diary_id
 *         - day_of_week
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the daily meal
 *         meal_diary_id:
 *           type: integer
 *           description: The id of the meal diary this daily meal belongs to
 *         day_of_week:
 *           type: integer
 *           description: The day of the week (1-7)
 *           minimum: 1
 *           maximum: 7
 *         breakfast:
 *           type: string
 *           description: The breakfast meal
 *           nullable: true
 *         lunch:
 *           type: string
 *           description: The lunch meal
 *           nullable: true
 *         dinner:
 *           type: string
 *           description: The dinner meal
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The date the daily meal was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date the daily meal was last updated
 */

/**
 * @openapi
 * /api/daily-meals/{meal_diary_id}:
 *   get:
 *     summary: Get all daily meals for a meal diary
 *     tags: [DailyMeals]
 *     parameters:
 *       - in: path
 *         name: meal_diary_id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The meal diary id
 *     responses:
 *       200:
 *         description: The list of daily meals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DailyMeal'
 *       400:
 *         description: Meal diary ID is required
 *       500:
 *         description: Failed to get daily meals
 */
router.get('/:meal_diary_id', async (req, res, next) => {
  try {
    await dailyMealController.getDailyMealsByMealDiaryId(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/daily-meals/{id}:
 *   put:
 *     summary: Update a daily meal
 *     tags: [DailyMeals]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The daily meal id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               breakfast:
 *                 type: string
 *                 nullable: true
 *               lunch:
 *                 type: string
 *                 nullable: true
 *               dinner:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: The updated daily meal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DailyMeal'
 *       404:
 *         description: Daily meal not found
 *       500:
 *         description: Failed to update daily meal
 */
router.put('/:id', async (req, res, next) => {
  try {
    await dailyMealController.updateDailyMealById(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;