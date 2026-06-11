import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MealDiary, DailyMeal } from '../../db/models/associations.ts';
import { getWeeklyMeals, updateDailyMeal } from '../mealDiary.service.ts';

const fakeDiary = (id: number) =>
  ({ dataValues: { id } }) as unknown as MealDiary;

const fakeDailyMeal = (values: Record<string, unknown>) =>
  ({
    dataValues: values,
    update: vi.fn().mockResolvedValue(undefined),
  }) as unknown as DailyMeal & { update: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('MealDiary Service', () => {
  describe('getWeeklyMeals', () => {
    it('should return an array of 7 days with null meals when no meals exist', async () => {
      vi.spyOn(MealDiary, 'findOrCreate').mockResolvedValue([
        fakeDiary(1),
        false,
      ]);
      vi.spyOn(DailyMeal, 'findAll').mockResolvedValue([]);

      const weeklyMeals = await getWeeklyMeals(1, new Date('2024-01-01'));

      expect(weeklyMeals).toHaveLength(7);
      weeklyMeals.forEach((meal, index) => {
        expect(meal.day_of_week).toBe(index + 1);
        expect(meal.breakfast).toBeNull();
        expect(meal.lunch).toBeNull();
        expect(meal.dinner).toBeNull();
      });
      expect(DailyMeal.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { meal_diary_id: 1 } })
      );
    });

    it('should return existing meals when they exist', async () => {
      vi.spyOn(MealDiary, 'findOrCreate').mockResolvedValue([
        fakeDiary(1),
        false,
      ]);
      vi.spyOn(DailyMeal, 'findAll').mockResolvedValue([
        fakeDailyMeal({
          day_of_week: 1,
          breakfast: 'Oatmeal',
          lunch: 'Sandwich',
          dinner: 'Pizza',
        }),
        fakeDailyMeal({
          day_of_week: 3,
          breakfast: 'Eggs',
          lunch: 'Salad',
          dinner: 'Pasta',
        }),
      ]);

      const weeklyMeals = await getWeeklyMeals(1, new Date('2024-01-01'));

      expect(weeklyMeals).toHaveLength(7);

      // Check day 1
      expect(weeklyMeals[0].day_of_week).toBe(1);
      expect(weeklyMeals[0].breakfast).toBe('Oatmeal');
      expect(weeklyMeals[0].lunch).toBe('Sandwich');
      expect(weeklyMeals[0].dinner).toBe('Pizza');

      // Check day 2 (should be null)
      expect(weeklyMeals[1].day_of_week).toBe(2);
      expect(weeklyMeals[1].breakfast).toBeNull();
      expect(weeklyMeals[1].lunch).toBeNull();
      expect(weeklyMeals[1].dinner).toBeNull();

      // Check day 3
      expect(weeklyMeals[2].day_of_week).toBe(3);
      expect(weeklyMeals[2].breakfast).toBe('Eggs');
      expect(weeklyMeals[2].lunch).toBe('Salad');
      expect(weeklyMeals[2].dinner).toBe('Pasta');
    });

    it('should create a new meal diary if it does not exist', async () => {
      const weekStartDate = new Date('2024-01-08');
      const findOrCreate = vi
        .spyOn(MealDiary, 'findOrCreate')
        .mockResolvedValue([fakeDiary(2), true]);
      vi.spyOn(DailyMeal, 'findAll').mockResolvedValue([]);

      const weeklyMeals = await getWeeklyMeals(1, weekStartDate);

      expect(findOrCreate).toHaveBeenCalledWith({
        where: { family_group_id: 1, week_start_date: weekStartDate },
        defaults: { family_group_id: 1, week_start_date: weekStartDate },
      });
      expect(weeklyMeals).toHaveLength(7);
    });
  });

  describe('updateDailyMeal', () => {
    it('should create a new daily meal if it does not exist', async () => {
      vi.spyOn(MealDiary, 'findOne').mockResolvedValue(fakeDiary(1));
      const dailyMeal = fakeDailyMeal({ day_of_week: 1 });
      const findOrCreate = vi
        .spyOn(DailyMeal, 'findOrCreate')
        .mockResolvedValue([dailyMeal, true]);

      const updatedMeal = await updateDailyMeal(1, new Date('2024-01-01'), 1, {
        breakfast: 'New Breakfast',
        lunch: 'New Lunch',
        dinner: 'New Dinner',
      });

      expect(findOrCreate).toHaveBeenCalledWith({
        where: { meal_diary_id: 1, day_of_week: 1 },
        defaults: { meal_diary_id: 1, day_of_week: 1 },
      });
      expect(dailyMeal.update).toHaveBeenCalledWith({
        breakfast: 'New Breakfast',
        lunch: 'New Lunch',
        dinner: 'New Dinner',
      });
      expect(updatedMeal).toBe(dailyMeal);
    });

    it('should only update the provided fields on an existing daily meal', async () => {
      vi.spyOn(MealDiary, 'findOne').mockResolvedValue(fakeDiary(1));
      const dailyMeal = fakeDailyMeal({
        day_of_week: 1,
        breakfast: 'Old Breakfast',
        lunch: 'Old Lunch',
        dinner: 'Old Dinner',
      });
      vi.spyOn(DailyMeal, 'findOrCreate').mockResolvedValue([dailyMeal, false]);

      await updateDailyMeal(1, new Date('2024-01-01'), 1, {
        breakfast: 'New Breakfast',
      });

      expect(dailyMeal.update).toHaveBeenCalledWith({
        breakfast: 'New Breakfast',
      });
    });

    it('should throw an error if meal diary does not exist', async () => {
      vi.spyOn(MealDiary, 'findOne').mockResolvedValue(null);
      const findOrCreate = vi.spyOn(DailyMeal, 'findOrCreate');

      await expect(
        updateDailyMeal(1, new Date('2025-01-01'), 1, {
          breakfast: 'New Breakfast',
        })
      ).rejects.toThrow('Meal diary not found for this week');
      expect(findOrCreate).not.toHaveBeenCalled();
    });

    it('should handle empty string values for meals', async () => {
      vi.spyOn(MealDiary, 'findOne').mockResolvedValue(fakeDiary(1));
      const dailyMeal = fakeDailyMeal({ day_of_week: 1 });
      vi.spyOn(DailyMeal, 'findOrCreate').mockResolvedValue([dailyMeal, false]);

      await updateDailyMeal(1, new Date('2024-01-01'), 1, {
        breakfast: '',
        lunch: '',
        dinner: '',
      });

      expect(dailyMeal.update).toHaveBeenCalledWith({
        breakfast: '',
        lunch: '',
        dinner: '',
      });
    });

    it('should keep null recipe ids so they can be cleared', async () => {
      vi.spyOn(MealDiary, 'findOne').mockResolvedValue(fakeDiary(1));
      const dailyMeal = fakeDailyMeal({ day_of_week: 1 });
      vi.spyOn(DailyMeal, 'findOrCreate').mockResolvedValue([dailyMeal, false]);

      await updateDailyMeal(1, new Date('2024-01-01'), 1, {
        dinner: 'Pizza',
        dinner_recipe_id: null,
      });

      expect(dailyMeal.update).toHaveBeenCalledWith(
        expect.objectContaining({ dinner: 'Pizza', dinner_recipe_id: null })
      );
    });
  });
});
