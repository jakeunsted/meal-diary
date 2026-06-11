import { describe, it, expect } from 'vitest';
import { ValidationError } from 'sequelize';
import { FamilyGroup, MealDiary } from '../associations.ts';

describe('MealDiary Model', () => {
  it('should build a valid meal diary that passes validation', async () => {
    const mealDiary = MealDiary.build({
      family_group_id: 1,
      week_start_date: new Date('2024-01-01'),
    });

    await expect(mealDiary.validate()).resolves.not.toThrow();
    expect(mealDiary.toJSON().family_group_id).toBe(1);
  });

  it('should require a family_group_id', async () => {
    const mealDiary = MealDiary.build({
      week_start_date: new Date('2024-01-01'),
    } as never);

    await expect(mealDiary.validate()).rejects.toThrow(ValidationError);
  });

  it('should require a week_start_date', async () => {
    const mealDiary = MealDiary.build({
      family_group_id: 1,
    } as never);

    await expect(mealDiary.validate()).rejects.toThrow(ValidationError);
  });

  it('should declare one diary per family group per week', () => {
    const indexes = MealDiary.options.indexes ?? [];

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unique: true,
          fields: ['family_group_id', 'week_start_date'],
        }),
      ])
    );
  });

  it('should belong to a family group', () => {
    expect(MealDiary.associations.FamilyGroup).toBeDefined();
    expect(MealDiary.associations.FamilyGroup.foreignKey).toBe(
      'family_group_id'
    );
    expect(FamilyGroup.associations.MealDiaries).toBeDefined();
  });
});
