import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Transaction } from 'sequelize';
import type { MealDiaryResolveSlot, MealDiarySyncSlot } from '@meal-diary/shared';
import {
  DailyMeal,
  DailyMealEntry,
  MealDiary,
  Recipe,
} from '../../db/models/associations.ts';
import sequelize from '../../db/models/index.ts';
import { assertCanUpdateMealWeek } from '../entitlements.service.ts';
import { getWeeklyMeals, type DailyMealWithDay } from '../mealDiary.service.ts';
import {
  applySlotDishUpdates,
  getActiveMealSlots,
} from '../mealSlots.service.ts';
import {
  MealDiarySyncValidationError,
  parseMealDiaryResolveSlots,
  parseMealDiarySyncSlots,
  resolveMealDiarySync,
  syncMealDiarySlots,
} from '../mealDiarySync.service.ts';

vi.mock('../entitlements.service.ts', () => ({
  assertCanUpdateMealWeek: vi.fn(),
}));

vi.mock('../mealSlots.service.ts', () => ({
  getActiveMealSlots: vi.fn(),
  applySlotDishUpdates: vi.fn(),
}));

vi.mock('../mealDiary.service.ts', () => ({
  getWeeklyMeals: vi.fn(),
}));

const weekStart = new Date('2026-10-19T00:00:00.000Z');

const weekDays: DailyMealWithDay[] = [
  {
    day_of_week: 1,
    breakfast: null,
    lunch: null,
    dinner: 'Soup',
    breakfast_recipe_id: null,
    lunch_recipe_id: null,
    dinner_recipe_id: null,
    slots: [],
  },
];

interface ServerEntry {
  meal_slot_id: number;
  dish: string | null;
  recipe_id: number | null;
}

let serverEntries: ServerEntry[] = [];

const syncInput = (slots: MealDiarySyncSlot[]) =>
  syncMealDiarySlots({
    familyGroupId: 1,
    userId: 7,
    weekStartDate: weekStart,
    slots,
  });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  serverEntries = [];

  vi.mocked(assertCanUpdateMealWeek).mockResolvedValue({ plan: 'free' } as never);
  vi.mocked(getActiveMealSlots).mockResolvedValue([
    { id: 10, name: 'Dinner', position: 3, legacy_key: 'dinner' },
    { id: 11, name: 'Snack', position: 4, legacy_key: null },
  ]);
  vi.mocked(applySlotDishUpdates).mockResolvedValue(undefined);
  vi.mocked(getWeeklyMeals).mockResolvedValue(weekDays);

  vi.spyOn(sequelize, 'transaction').mockImplementation((async (
    callback: (transaction: object) => Promise<unknown>
  ) => callback({})) as never);

  vi.spyOn(MealDiary, 'findOrCreate').mockResolvedValue([
    { dataValues: { id: 9 } },
    false,
  ] as never);

  vi.spyOn(DailyMeal, 'findOrCreate').mockImplementation((async (options: {
    where?: { day_of_week?: number };
  }) => {
    const dayOfWeek = Number(options.where?.day_of_week);
    return [
      {
        dataValues: {
          id: 500 + dayOfWeek,
          day_of_week: dayOfWeek,
        },
      },
      false,
    ];
  }) as never);

  vi.spyOn(DailyMeal, 'findOne').mockImplementation((async (options: {
    where?: { id?: number };
  }) => {
    const id = Number(options.where?.id);
    return {
      dataValues: {
        id,
        day_of_week: id - 500,
        breakfast: null,
        lunch: null,
        dinner: null,
        breakfast_recipe_id: null,
        lunch_recipe_id: null,
        dinner_recipe_id: null,
      },
    };
  }) as never);

  vi.spyOn(DailyMeal, 'update').mockRejectedValue(new Error('unexpected daily meal update'));
  vi.spyOn(DailyMealEntry, 'create').mockRejectedValue(new Error('unexpected entry create'));
  vi.spyOn(DailyMealEntry, 'findOrCreate').mockRejectedValue(
    new Error('unexpected entry findOrCreate')
  );
  vi.spyOn(DailyMealEntry, 'update').mockRejectedValue(new Error('unexpected entry update'));
  vi.spyOn(DailyMealEntry, 'findAll').mockImplementation((async () =>
    serverEntries.map((entry) => ({
      dataValues: {
        daily_meal_id: 501,
        meal_slot_id: entry.meal_slot_id,
        dish: entry.dish,
        recipe_id: entry.recipe_id,
      },
    }))
  ) as never);

  vi.spyOn(Recipe, 'findAll').mockResolvedValue([
    { dataValues: { id: 4 } },
  ] as never);
});

describe('syncMealDiarySlots', () => {
  it('applies a slot when the server still matches the baseline', async () => {
    serverEntries = [{ meal_slot_id: 10, dish: 'Soup', recipe_id: null }];

    const result = await syncInput([
      {
        day_of_week: 1,
        meal_slot_id: 10,
        baseline: { dish: ' Soup ', recipe_id: null },
        dish: 'Stew',
        recipe_id: 4,
      },
    ]);

    expect(assertCanUpdateMealWeek).toHaveBeenCalledWith(1, 7, weekStart);
    expect(result.results).toEqual([
      { day_of_week: 1, meal_slot_id: 10, status: 'applied' },
    ]);
    expect(result.dailyMeals).toEqual(weekDays);
    expect(result.appliedDays).toEqual([
      { day_of_week: 1, mealTypes: ['dinner'] },
    ]);
    expect(applySlotDishUpdates).toHaveBeenCalledTimes(1);
    expect(applySlotDishUpdates).toHaveBeenCalledWith(
      1,
      501,
      [{ meal_slot_id: 10, dish: 'Stew', recipe_id: 4 }],
      expect.anything()
    );
    expect(DailyMealEntry.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { daily_meal_id: 501 },
        lock: Transaction.LOCK.UPDATE,
      })
    );
    expect(vi.mocked(getWeeklyMeals).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(applySlotDishUpdates).mock.invocationCallOrder[0] ?? 0
    );
  });

  it('marks a slot already saved when yours matches the server', async () => {
    serverEntries = [{ meal_slot_id: 10, dish: ' Soup ', recipe_id: null }];

    const result = await syncInput([
      {
        day_of_week: 1,
        meal_slot_id: 10,
        baseline: { dish: 'Toast', recipe_id: null },
        dish: 'Soup',
        recipe_id: null,
      },
    ]);

    expect(result.results).toEqual([
      { day_of_week: 1, meal_slot_id: 10, status: 'already_saved' },
    ]);
    expect(result.appliedDays).toEqual([]);
    expect(applySlotDishUpdates).not.toHaveBeenCalled();
    expect(Recipe.findAll).not.toHaveBeenCalled();
  });

  it('returns a conflict and does not write when the server has moved', async () => {
    serverEntries = [{ meal_slot_id: 10, dish: 'Soup', recipe_id: null }];

    const result = await syncInput([
      {
        day_of_week: 1,
        meal_slot_id: 10,
        baseline: { dish: ' Salad ', recipe_id: null },
        dish: ' Stew ',
        recipe_id: 4,
      },
    ]);

    expect(result.results).toEqual([
      {
        day_of_week: 1,
        meal_slot_id: 10,
        status: 'conflict',
        yours: { dish: 'Stew', recipe_id: 4 },
        theirs: { dish: 'Soup', recipe_id: null },
        baseline: { dish: 'Salad', recipe_id: null },
      },
    ]);
    expect(result.appliedDays).toEqual([]);
    expect(applySlotDishUpdates).not.toHaveBeenCalled();
    expect(DailyMealEntry.create).not.toHaveBeenCalled();
    expect(DailyMealEntry.findOrCreate).not.toHaveBeenCalled();
    expect(DailyMeal.update).not.toHaveBeenCalled();
  });

  it('still applies a second slot on the same day when another slot conflicts', async () => {
    serverEntries = [{ meal_slot_id: 10, dish: 'Soup', recipe_id: null }];

    const result = await syncInput([
      {
        day_of_week: 1,
        meal_slot_id: 10,
        baseline: { dish: 'Salad', recipe_id: null },
        dish: 'Stew',
        recipe_id: null,
      },
      {
        day_of_week: 1,
        meal_slot_id: 11,
        baseline: { dish: null, recipe_id: null },
        dish: ' Toast ',
        recipe_id: null,
      },
    ]);

    expect(result.results).toEqual([
      {
        day_of_week: 1,
        meal_slot_id: 10,
        status: 'conflict',
        yours: { dish: 'Stew', recipe_id: null },
        theirs: { dish: 'Soup', recipe_id: null },
        baseline: { dish: 'Salad', recipe_id: null },
      },
      { day_of_week: 1, meal_slot_id: 11, status: 'applied' },
    ]);
    expect(applySlotDishUpdates).toHaveBeenCalledTimes(1);
    expect(applySlotDishUpdates).toHaveBeenCalledWith(
      1,
      501,
      [{ meal_slot_id: 11, dish: 'Toast', recipe_id: null }],
      expect.anything()
    );
    expect(result.appliedDays).toEqual([
      { day_of_week: 1, mealTypes: ['slot_11'] },
    ]);
  });

  it('does not recreate an entry for a removed slot', async () => {
    serverEntries = [{ meal_slot_id: 99, dish: 'Old stew', recipe_id: null }];

    const result = await syncInput([
      {
        day_of_week: 1,
        meal_slot_id: 99,
        baseline: { dish: null, recipe_id: null },
        dish: 'Stew',
        recipe_id: null,
      },
    ]);

    expect(result.results).toEqual([
      { day_of_week: 1, meal_slot_id: 99, status: 'slot_removed' },
    ]);
    expect(applySlotDishUpdates).not.toHaveBeenCalled();
    expect(DailyMealEntry.create).not.toHaveBeenCalled();
    expect(DailyMealEntry.findOrCreate).not.toHaveBeenCalled();
    expect(DailyMealEntry.update).not.toHaveBeenCalled();
    expect(DailyMeal.update).not.toHaveBeenCalled();
  });

  it('rejects a recipe that is not in the family and writes nothing', async () => {
    serverEntries = [{ meal_slot_id: 10, dish: 'Soup', recipe_id: null }];

    const result = await syncInput([
      {
        day_of_week: 1,
        meal_slot_id: 10,
        baseline: { dish: 'Soup', recipe_id: null },
        dish: 'Stew',
        recipe_id: 99,
      },
    ]);

    expect(result.results).toEqual([
      { day_of_week: 1, meal_slot_id: 10, status: 'recipe_rejected' },
    ]);
    expect(applySlotDishUpdates).not.toHaveBeenCalled();
  });

  it('returns the current week for an empty slot list without writing', async () => {
    const result = await syncInput([]);

    expect(result.results).toEqual([]);
    expect(result.dailyMeals).toEqual(weekDays);
    expect(result.appliedDays).toEqual([]);
    expect(assertCanUpdateMealWeek).toHaveBeenCalledWith(1, 7, weekStart);
    expect(sequelize.transaction).not.toHaveBeenCalled();
    expect(applySlotDishUpdates).not.toHaveBeenCalled();
    expect(getWeeklyMeals).toHaveBeenCalledWith(1, weekStart);
  });

  it('rejects a past week before any write', async () => {
    vi.mocked(assertCanUpdateMealWeek).mockRejectedValue(
      new Error('ENTITLEMENT_REQUIRED')
    );
    serverEntries = [{ meal_slot_id: 10, dish: 'Soup', recipe_id: null }];

    await expect(
      syncInput([
        {
          day_of_week: 1,
          meal_slot_id: 10,
          baseline: { dish: 'Soup', recipe_id: null },
          dish: 'Stew',
          recipe_id: null,
        },
      ])
    ).rejects.toThrow('ENTITLEMENT_REQUIRED');

    expect(sequelize.transaction).not.toHaveBeenCalled();
    expect(MealDiary.findOrCreate).not.toHaveBeenCalled();
    expect(applySlotDishUpdates).not.toHaveBeenCalled();
    expect(DailyMealEntry.findAll).not.toHaveBeenCalled();
    expect(getWeeklyMeals).not.toHaveBeenCalled();
  });
});

describe('resolveMealDiarySync', () => {
  const keepMine = (expectedDish: string): MealDiaryResolveSlot => ({
    day_of_week: 1,
    meal_slot_id: 10,
    dish: 'Stew',
    recipe_id: 4,
    expected: { dish: expectedDish, recipe_id: null },
    baseline: { dish: 'Soup', recipe_id: null },
  });

  it('writes only when the server still matches expected', async () => {
    serverEntries = [{ meal_slot_id: 10, dish: 'Pasta', recipe_id: null }];

    const result = await resolveMealDiarySync({
      familyGroupId: 1,
      userId: 7,
      weekStartDate: weekStart,
      keepMine: [keepMine('Pasta')],
    });

    expect(result.results).toEqual([
      { day_of_week: 1, meal_slot_id: 10, status: 'applied' },
    ]);
    expect(applySlotDishUpdates).toHaveBeenCalledWith(
      1,
      501,
      [{ meal_slot_id: 10, dish: 'Stew', recipe_id: 4 }],
      expect.anything()
    );
  });

  it('returns a new conflict and does not write when the server has moved', async () => {
    serverEntries = [{ meal_slot_id: 10, dish: 'Curry', recipe_id: null }];

    const result = await resolveMealDiarySync({
      familyGroupId: 1,
      userId: 7,
      weekStartDate: weekStart,
      keepMine: [keepMine('Pasta')],
    });

    expect(result.results).toEqual([
      {
        day_of_week: 1,
        meal_slot_id: 10,
        status: 'conflict',
        yours: { dish: 'Stew', recipe_id: 4 },
        theirs: { dish: 'Curry', recipe_id: null },
        baseline: { dish: 'Soup', recipe_id: null },
      },
    ]);
    expect(result.appliedDays).toEqual([]);
    expect(applySlotDishUpdates).not.toHaveBeenCalled();
  });
});

describe('meal diary sync parsing', () => {
  it('rejects a slots value that is not an array', () => {
    expect(() => parseMealDiarySyncSlots(null)).toThrow(MealDiarySyncValidationError);
    expect(() => parseMealDiarySyncSlots(null)).toThrow('slots must be an array');
  });

  it('rejects a day outside 1-7 and a dish longer than 200 characters', () => {
    expect(() =>
      parseMealDiarySyncSlots([
        {
          day_of_week: 0,
          meal_slot_id: 10,
          baseline: { dish: null, recipe_id: null },
          dish: 'Stew',
          recipe_id: null,
        },
      ])
    ).toThrow('day_of_week must be between 1 and 7');

    expect(() =>
      parseMealDiarySyncSlots([
        {
          day_of_week: 1,
          meal_slot_id: 10,
          baseline: { dish: null, recipe_id: null },
          dish: 'a'.repeat(201),
          recipe_id: null,
        },
      ])
    ).toThrow('dish must be 200 characters or fewer');
  });

  it('normalizes a blank dish to null', () => {
    expect(
      parseMealDiarySyncSlots([
        {
          day_of_week: 1,
          meal_slot_id: 10,
          baseline: { dish: '  ', recipe_id: null },
          dish: '   ',
          recipe_id: null,
        },
      ])
    ).toEqual([
      {
        day_of_week: 1,
        meal_slot_id: 10,
        baseline: { dish: null, recipe_id: null },
        dish: null,
        recipe_id: null,
      },
    ]);
  });

  it('rejects keep_mine when it is not an array', () => {
    expect(() => parseMealDiaryResolveSlots(undefined)).toThrow(
      'keep_mine must be an array'
    );
  });
});
