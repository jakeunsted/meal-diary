import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MealDiary, DailyMeal } from '../../db/models/associations.ts';
import { getWeeklyMeals, updateDailyMeal } from '../mealDiary.service.ts';

vi.mock('../mealSlots.service.ts', () => ({
  ensureDefaultMealSlots: vi.fn().mockResolvedValue([
    {
      dataValues: {
        id: 1,
        name: 'Breakfast',
        position: 1,
        legacy_key: 'breakfast',
        archived_at: null,
      },
    },
    {
      dataValues: {
        id: 2,
        name: 'Lunch',
        position: 2,
        legacy_key: 'lunch',
        archived_at: null,
      },
    },
    {
      dataValues: {
        id: 3,
        name: 'Dinner',
        position: 3,
        legacy_key: 'dinner',
        archived_at: null,
      },
    },
  ]),
  buildDaySlotsForWeek: vi.fn().mockResolvedValue(new Map()),
  syncLegacyColumnsToEntries: vi.fn().mockResolvedValue(undefined),
  assertRecipesBelongToFamily: vi.fn().mockResolvedValue(undefined),
  RECIPE_NOT_IN_FAMILY_MESSAGE: 'Recipe does not belong to this family group',
}));

const fakeDiary = (id: number) =>
  ({ dataValues: { id } }) as unknown as MealDiary;

const fakeDailyMeal = (values: Record<string, unknown>) =>
  ({
    dataValues: values,
    update: vi.fn().mockResolvedValue(undefined),
  }) as unknown as DailyMeal & { update: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MealDiary Service', () => {
  describe('getWeeklyMeals', () => {
    it('should return an array of 7 days with null meals when no meals exist', async () => {
      vi.spyOn(MealDiary, 'findOrCreate').mockResolvedValue([
        fakeDiary(1),
        false,
      ]);
      vi.spyOn(DailyMeal, 'findAll').mockResolvedValue([]);
      vi.spyOn(DailyMeal, 'findOrCreate').mockImplementation(async ({ defaults }: any) => [
        fakeDailyMeal({
          id: defaults.day_of_week,
          day_of_week: defaults.day_of_week,
          breakfast: null,
          lunch: null,
          dinner: null,
          breakfast_recipe_id: null,
          lunch_recipe_id: null,
          dinner_recipe_id: null,
        }),
        true,
      ] as never);

      const weeklyMeals = await getWeeklyMeals(1, new Date('2024-01-01'));

      expect(weeklyMeals).toHaveLength(7);
      weeklyMeals.forEach((meal, index) => {
        expect(meal.day_of_week).toBe(index + 1);
        expect(meal.breakfast).toBeNull();
        expect(meal.lunch).toBeNull();
        expect(meal.dinner).toBeNull();
        expect(meal.slots).toEqual([]);
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
          id: 101,
          day_of_week: 1,
          breakfast: 'Oatmeal',
          lunch: 'Sandwich',
          dinner: 'Pizza',
          breakfast_recipe_id: null,
          lunch_recipe_id: null,
          dinner_recipe_id: null,
        }),
        fakeDailyMeal({
          id: 103,
          day_of_week: 3,
          breakfast: 'Eggs',
          lunch: 'Salad',
          dinner: 'Pasta',
          breakfast_recipe_id: null,
          lunch_recipe_id: null,
          dinner_recipe_id: null,
        }),
      ]);
      vi.spyOn(DailyMeal, 'findOrCreate').mockImplementation(async ({ defaults }: any) => [
        fakeDailyMeal({
          id: defaults.day_of_week,
          day_of_week: defaults.day_of_week,
          breakfast: null,
          lunch: null,
          dinner: null,
          breakfast_recipe_id: null,
          lunch_recipe_id: null,
          dinner_recipe_id: null,
        }),
        true,
      ] as never);

      const weeklyMeals = await getWeeklyMeals(1, new Date('2024-01-01'));

      expect(weeklyMeals).toHaveLength(7);

      expect(weeklyMeals[0].day_of_week).toBe(1);
      expect(weeklyMeals[0].breakfast).toBe('Oatmeal');
      expect(weeklyMeals[0].lunch).toBe('Sandwich');
      expect(weeklyMeals[0].dinner).toBe('Pizza');

      expect(weeklyMeals[1].day_of_week).toBe(2);
      expect(weeklyMeals[1].breakfast).toBeNull();
      expect(weeklyMeals[1].lunch).toBeNull();
      expect(weeklyMeals[1].dinner).toBeNull();

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
      vi.spyOn(DailyMeal, 'findOrCreate').mockImplementation(async ({ defaults }: any) => [
        fakeDailyMeal({
          id: defaults.day_of_week,
          day_of_week: defaults.day_of_week,
          breakfast: null,
          lunch: null,
          dinner: null,
          breakfast_recipe_id: null,
          lunch_recipe_id: null,
          dinner_recipe_id: null,
        }),
        true,
      ] as never);

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
      vi.spyOn(DailyMeal, 'findOrCreate').mockResolvedValue([dailyMeal, true]);

      const updatedMeal = await updateDailyMeal(1, new Date('2024-01-01'), 1, {
        breakfast: 'New Breakfast',
        lunch: 'New Lunch',
        dinner: 'New Dinner',
      });

      expect(dailyMeal.update).toHaveBeenCalledWith({
        breakfast: 'New Breakfast',
        lunch: 'New Lunch',
        dinner: 'New Dinner',
      });
      expect(updatedMeal).toBe(dailyMeal);

      const { syncLegacyColumnsToEntries } = await import('../mealSlots.service.ts');
      expect(syncLegacyColumnsToEntries).toHaveBeenCalled();
    });

    it('should update an existing daily meal', async () => {
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

    it('should throw an error if the meal diary is not found', async () => {
      vi.spyOn(MealDiary, 'findOne').mockResolvedValue(null);
      const findOrCreate = vi.spyOn(DailyMeal, 'findOrCreate');

      await expect(
        updateDailyMeal(1, new Date('2025-01-01'), 1, {
          breakfast: 'New Breakfast',
        })
      ).rejects.toThrow('Meal diary not found for this week');
      expect(findOrCreate).not.toHaveBeenCalled();
    });

    it('should handle empty string values', async () => {
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

    it('should allow clearing recipe ids with null', async () => {
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

    it('should reject recipe ids that do not belong to the family', async () => {
      const { assertRecipesBelongToFamily, RECIPE_NOT_IN_FAMILY_MESSAGE } =
        await import('../mealSlots.service.ts');
      vi.mocked(assertRecipesBelongToFamily).mockRejectedValueOnce(
        new Error(RECIPE_NOT_IN_FAMILY_MESSAGE)
      );
      vi.spyOn(MealDiary, 'findOne').mockResolvedValue(fakeDiary(1));
      const findOrCreate = vi.spyOn(DailyMeal, 'findOrCreate');

      await expect(
        updateDailyMeal(1, new Date('2024-01-01'), 1, {
          dinner_recipe_id: 999,
        })
      ).rejects.toThrow(RECIPE_NOT_IN_FAMILY_MESSAGE);
      expect(findOrCreate).not.toHaveBeenCalled();
    });
  });
});
