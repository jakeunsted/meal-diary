import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FamilyGroup,
  MealSlot,
  MealDiary,
  DailyMeal,
  DailyMealEntry,
} from '../../db/models/associations.ts';
import sequelize from '../../db/models/index.ts';
import {
  assertTodayWithinSkew,
  backfillMealSlots,
  calendarDateForDiaryDay,
  countFutureContentBySlotId,
  ensureDefaultMealSlots,
  MealSlotsConfirmationRequiredError,
  replaceMealSlots,
  syncLegacyColumnsToEntries,
} from '../mealSlots.service.ts';

const fakeSlot = (values: Record<string, unknown>) =>
  ({
    dataValues: values,
    update: vi.fn().mockResolvedValue(undefined),
  }) as unknown as MealSlot & { update: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('calendarDateForDiaryDay', () => {
  it('maps Monday week start + day_of_week to a UTC calendar date', () => {
    expect(calendarDateForDiaryDay('2024-01-01', 1).toISOString()).toBe(
      '2024-01-01T00:00:00.000Z'
    );
    expect(calendarDateForDiaryDay('2024-01-01', 3).toISOString()).toBe(
      '2024-01-03T00:00:00.000Z'
    );
  });
});

describe('assertTodayWithinSkew', () => {
  it('accepts today within one day of the server UTC date', () => {
    const server = new Date('2024-06-15T12:00:00.000Z');
    expect(assertTodayWithinSkew('2024-06-15', server).toISOString()).toBe(
      '2024-06-15T00:00:00.000Z'
    );
    expect(assertTodayWithinSkew('2024-06-16', server).toISOString()).toBe(
      '2024-06-16T00:00:00.000Z'
    );
  });

  it('rejects today more than one day away', () => {
    const server = new Date('2024-06-15T12:00:00.000Z');
    expect(() => assertTodayWithinSkew('2024-06-18', server)).toThrow(
      'today must be within one day'
    );
  });
});

describe('ensureDefaultMealSlots', () => {
  it('creates Breakfast Lunch Dinner once and is idempotent', async () => {
    const findAll = vi
      .spyOn(MealSlot, 'findAll')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        fakeSlot({
          id: 1,
          name: 'Breakfast',
          position: 1,
          legacy_key: 'breakfast',
          archived_at: null,
        }),
      ] as never);

    const bulkCreate = vi.spyOn(MealSlot, 'bulkCreate').mockResolvedValue([
      fakeSlot({
        id: 1,
        name: 'Breakfast',
        position: 1,
        legacy_key: 'breakfast',
        archived_at: null,
      }),
    ] as never);

    await ensureDefaultMealSlots(9);
    expect(bulkCreate).toHaveBeenCalledOnce();

    await ensureDefaultMealSlots(9);
    expect(bulkCreate).toHaveBeenCalledOnce();
    expect(findAll).toHaveBeenCalledTimes(2);
  });
});

describe('backfillMealSlots', () => {
  it('does not update daily_meals rows', async () => {
    vi.spyOn(FamilyGroup, 'findAll').mockResolvedValue([
      { dataValues: { id: 1 } },
    ] as never);
    vi.spyOn(MealSlot, 'findAll').mockResolvedValue([
      fakeSlot({
        id: 10,
        name: 'Breakfast',
        position: 1,
        legacy_key: 'breakfast',
        archived_at: null,
        family_group_id: 1,
      }),
      fakeSlot({
        id: 11,
        name: 'Lunch',
        position: 2,
        legacy_key: 'lunch',
        archived_at: null,
        family_group_id: 1,
      }),
      fakeSlot({
        id: 12,
        name: 'Dinner',
        position: 3,
        legacy_key: 'dinner',
        archived_at: null,
        family_group_id: 1,
      }),
    ] as never);
    vi.spyOn(MealDiary, 'findAll').mockResolvedValue([
      { dataValues: { id: 100 } },
    ] as never);
    vi.spyOn(DailyMeal, 'findAll').mockResolvedValue([
      {
        dataValues: {
          id: 200,
          breakfast: 'Oats',
          lunch: null,
          dinner: null,
          breakfast_recipe_id: null,
          lunch_recipe_id: null,
          dinner_recipe_id: null,
        },
      },
    ] as never);
    vi.spyOn(DailyMealEntry, 'findAll').mockResolvedValue([]);
    const create = vi.spyOn(DailyMealEntry, 'create').mockResolvedValue({} as never);
    const dailyMealUpdate = vi.spyOn(DailyMeal, 'update');

    const result = await backfillMealSlots();

    expect(result.familiesEnsured).toBe(1);
    expect(result.entriesCreated).toBe(3);
    expect(create).toHaveBeenCalledTimes(3);
    expect(dailyMealUpdate).not.toHaveBeenCalled();
  });
});

describe('countFutureContentBySlotId', () => {
  it('counts only today-and-later days with dish or recipe', async () => {
    vi.spyOn(MealDiary, 'findAll').mockResolvedValue([
      { dataValues: { id: 1, week_start_date: '2024-06-10' } },
    ] as never);
    // Mon=1 … Sun=7 for week starting 2024-06-10
    vi.spyOn(DailyMeal, 'findAll').mockResolvedValue([
      { dataValues: { id: 10, meal_diary_id: 1, day_of_week: 1 } }, // Jun 10 past
      { dataValues: { id: 11, meal_diary_id: 1, day_of_week: 6 } }, // Jun 15 today
    ] as never);
    vi.spyOn(DailyMealEntry, 'findAll').mockResolvedValue([
      { dataValues: { meal_slot_id: 2, dish: 'Soup', recipe_id: null } },
    ] as never);

    const counts = await countFutureContentBySlotId(
      1,
      [2],
      new Date('2024-06-15T00:00:00.000Z')
    );

    expect(counts['2']).toBe(1);
  });
});

describe('replaceMealSlots', () => {
  it('returns 409-shaped error when removal would clear future meals without confirm', async () => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    // Build a Monday on or before today so day_of_week 1 is still in the future/today window
    const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const day = monday.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setUTCDate(monday.getUTCDate() + diff);
    const weekStart = monday.toISOString().slice(0, 10);
    const dayOfWeek =
      ((today.getUTCDay() + 6) % 7) + 1; // convert JS Sun=0 to Mon=1…Sun=7

    vi.spyOn(sequelize, 'transaction').mockImplementation(async (cb: any) =>
      cb({})
    );
    vi.spyOn(MealSlot, 'findAll').mockResolvedValue([
      fakeSlot({
        id: 1,
        name: 'Breakfast',
        position: 1,
        legacy_key: 'breakfast',
        archived_at: null,
      }),
      fakeSlot({
        id: 2,
        name: 'Lunch',
        position: 2,
        legacy_key: 'lunch',
        archived_at: null,
      }),
      fakeSlot({
        id: 3,
        name: 'Dinner',
        position: 3,
        legacy_key: 'dinner',
        archived_at: null,
      }),
    ] as never);

    vi.spyOn(MealDiary, 'findAll').mockResolvedValue([
      { dataValues: { id: 1, week_start_date: weekStart } },
    ] as never);
    vi.spyOn(DailyMeal, 'findAll').mockResolvedValue([
      { dataValues: { id: 11, meal_diary_id: 1, day_of_week: dayOfWeek } },
    ] as never);
    vi.spyOn(DailyMealEntry, 'findAll').mockResolvedValue([
      { dataValues: { meal_slot_id: 2, dish: 'Soup', recipe_id: null } },
    ] as never);

    await expect(
      replaceMealSlots(
        1,
        [
          { id: 1, name: 'Breakfast' },
          { id: 3, name: 'Dinner' },
        ],
        todayStr,
        false
      )
    ).rejects.toBeInstanceOf(MealSlotsConfirmationRequiredError);
  });
});

describe('syncLegacyColumnsToEntries', () => {
  it('upserts only the legacy slots present in the patch', async () => {
    vi.spyOn(MealSlot, 'findAll').mockResolvedValue([
      fakeSlot({
        id: 1,
        name: 'Breakfast',
        position: 1,
        legacy_key: 'breakfast',
        archived_at: null,
      }),
      fakeSlot({
        id: 2,
        name: 'Lunch',
        position: 2,
        legacy_key: 'lunch',
        archived_at: null,
      }),
      fakeSlot({
        id: 3,
        name: 'Dinner',
        position: 3,
        legacy_key: 'dinner',
        archived_at: null,
      }),
    ] as never);

    const entry = {
      dataValues: { id: 50 },
      update: vi.fn().mockResolvedValue(undefined),
    };
    const findOrCreate = vi
      .spyOn(DailyMealEntry, 'findOrCreate')
      .mockResolvedValue([entry as never, true]);

    await syncLegacyColumnsToEntries(1, 99, { breakfast: 'Toast' });

    expect(findOrCreate).toHaveBeenCalledTimes(1);
    expect(findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { daily_meal_id: 99, meal_slot_id: 1 },
      })
    );
    expect(entry.update).toHaveBeenCalledWith(
      expect.objectContaining({ dish: 'Toast' }),
      expect.anything()
    );
  });
});
