import { describe, it, expect } from 'vitest';
import { ValidationError } from 'sequelize';
import { MealDiary, DailyMeal } from '../associations.ts';

describe('DailyMeal Model', () => {
  it('should build a valid daily meal that passes validation', async () => {
    const dailyMeal = DailyMeal.build({
      meal_diary_id: 1,
      day_of_week: 1,
      breakfast: 'Oatmeal with berries',
      lunch: 'Chicken salad',
      dinner: 'Grilled salmon with vegetables',
    });

    await expect(dailyMeal.validate()).resolves.not.toThrow();

    const dailyMealJson = dailyMeal.toJSON();
    expect(dailyMealJson.meal_diary_id).toBe(1);
    expect(dailyMealJson.day_of_week).toBe(1);
    expect(dailyMealJson.breakfast).toBe('Oatmeal with berries');
    expect(dailyMealJson.lunch).toBe('Chicken salad');
    expect(dailyMealJson.dinner).toBe('Grilled salmon with vegetables');
  });

  it('should enforce day_of_week validation', async () => {
    const tooHigh = DailyMeal.build({
      meal_diary_id: 1,
      day_of_week: 8, // Invalid: should be 1-7
    });
    await expect(tooHigh.validate()).rejects.toThrow(ValidationError);
    await expect(tooHigh.validate()).rejects.toThrow(
      'Validation max on day_of_week failed'
    );

    const tooLow = DailyMeal.build({
      meal_diary_id: 1,
      day_of_week: 0, // Invalid: should be 1-7
    });
    await expect(tooLow.validate()).rejects.toThrow(ValidationError);
    await expect(tooLow.validate()).rejects.toThrow(
      'Validation min on day_of_week failed'
    );
  });

  it('should require a meal_diary_id', async () => {
    const dailyMeal = DailyMeal.build({
      day_of_week: 1,
    } as never);

    await expect(dailyMeal.validate()).rejects.toThrow(ValidationError);
  });

  it('should declare a unique index on meal_diary_id and day_of_week', () => {
    const indexes = DailyMeal.options.indexes ?? [];

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unique: true,
          fields: ['meal_diary_id', 'day_of_week'],
        }),
      ])
    );
  });

  it('should belong to a meal diary', () => {
    expect(DailyMeal.associations.MealDiary).toBeDefined();
    expect(DailyMeal.associations.MealDiary.foreignKey).toBe('meal_diary_id');
    expect(MealDiary.associations.DailyMeals).toBeDefined();
  });
});
