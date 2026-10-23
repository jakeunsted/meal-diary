import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Op } from 'sequelize';
import {
  FamilyGroup,
  MealSlot,
  MealDiary,
  DailyMeal,
  DailyMealEntry,
  Recipe,
  Subscription,
} from '../../db/models/associations.ts';
import sequelize from '../../db/models/index.ts';
import * as sseService from '../sse.service.ts';
import {
  applyMealNamesResetIfDue,
  assertRecipesBelongToFamily,
  assertTodayWithinSkew,
  backfillMealSlots,
  buildDaySlotsForWeek,
  calendarDateForDiaryDay,
  countFutureContentBySlotId,
  ensureDefaultMealSlots,
  getActiveMealSlots,
  MealNamesResetForbiddenError,
  MealSlotsConfirmationRequiredError,
  MealSlotsValidationError,
  RECIPE_NOT_IN_FAMILY_MESSAGE,
  replaceMealSlots,
  scheduleMealNamesReset,
  syncLegacyColumnsToEntries,
  updateSubscriptionClearingMealNamesResetWhenPremium,
} from '../mealSlots.service.ts';

const fakeSlot = (values: Record<string, unknown>) =>
  ({
    dataValues: values,
    update: vi.fn().mockResolvedValue(undefined),
  }) as unknown as MealSlot & { update: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('assertRecipesBelongToFamily', () => {
  it('allows null and undefined recipe ids without querying', async () => {
    const count = vi.spyOn(Recipe, 'count');

    await assertRecipesBelongToFamily(1, [null, undefined]);

    expect(count).not.toHaveBeenCalled();
  });

  it('allows recipes that all belong to the family', async () => {
    vi.spyOn(Recipe, 'count').mockResolvedValue(2 as never);

    await expect(
      assertRecipesBelongToFamily(7, [10, 11, 10])
    ).resolves.toBeUndefined();

    expect(Recipe.count).toHaveBeenCalledWith({
      where: {
        id: { [Op.in]: [10, 11] },
        family_group_id: 7,
      },
    });
  });

  it('rejects when any recipe is missing or from another family', async () => {
    vi.spyOn(Recipe, 'count').mockResolvedValue(1 as never);

    await expect(assertRecipesBelongToFamily(7, [10, 99])).rejects.toThrow(
      RECIPE_NOT_IN_FAMILY_MESSAGE
    );
  });
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

describe('meal name reset after Family Plus ends', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback: any) => callback({}));
    vi.spyOn(sseService, 'emitFamilyEvent').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const resetSlot = (values: {
    id: number;
    name: string;
    position: number;
    legacy_key: string | null;
    archived_at?: Date | null;
  }) => {
    const dataValues = {
      family_group_id: 1,
      archived_at: null as Date | null,
      ...values,
    };
    return {
      dataValues,
      update: vi.fn(async (patch: Record<string, unknown>) => {
        Object.assign(dataValues, patch);
      }),
    };
  };

  const customSlots = () => [
    resetSlot({ id: 1, name: 'Brekkie', position: 1, legacy_key: 'breakfast' }),
    resetSlot({ id: 2, name: 'Lunch', position: 2, legacy_key: 'lunch' }),
    resetSlot({ id: 3, name: 'Dinner', position: 3, legacy_key: 'dinner' }),
    resetSlot({ id: 4, name: 'Snack', position: 4, legacy_key: null }),
  ];

  const subscriptionRow = (overrides: Record<string, unknown> = {}) => {
    const dataValues = {
      id: 5,
      family_group_id: 1,
      plan: 'free',
      status: 'expired',
      is_complimentary: false,
      meal_names_reset_effective_on: null as string | null,
      meal_names_reset_applied_at: null as Date | null,
      ...overrides,
    };
    return {
      dataValues,
      update: vi.fn(async (patch: Record<string, unknown>) => {
        Object.assign(dataValues, patch);
      }),
    };
  };

  const mockSlots = (slots: ReturnType<typeof customSlots>) => {
    vi.spyOn(MealSlot, 'findAll').mockImplementation(async (options: any) => {
      const where = options?.where ?? {};
      if (where.archived_at === null) {
        return slots.filter((slot) => slot.dataValues.archived_at == null) as never;
      }
      return slots as never;
    });
    vi.spyOn(MealSlot, 'create').mockImplementation(async (values: any) => {
      const created = resetSlot({
        id: 50,
        name: values.name,
        position: values.position,
        legacy_key: values.legacy_key,
      });
      slots.push(created);
      return created as never;
    });
  };

  const mockScheduleWorld = (
    slots = customSlots(),
    overrides: Record<string, unknown> = {}
  ) => {
    const subscription = subscriptionRow(overrides);
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue({
      dataValues: { id: 1, created_by: 10 },
    } as never);
    vi.spyOn(Subscription, 'findOrCreate').mockResolvedValue([subscription, false] as never);
    vi.spyOn(Subscription, 'findOne').mockResolvedValue(subscription as never);
    mockSlots(slots);
    vi.spyOn(MealDiary, 'findAll').mockResolvedValue([
      { dataValues: { id: 1, week_start_date: '2024-06-10' } },
    ] as never);
    vi.spyOn(DailyMeal, 'findAll').mockResolvedValue([
      { dataValues: { id: 14, meal_diary_id: 1, day_of_week: 5 } },
      { dataValues: { id: 15, meal_diary_id: 1, day_of_week: 6 } },
      { dataValues: { id: 16, meal_diary_id: 1, day_of_week: 7 } },
    ] as never);
    const entryUpdate = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(DailyMealEntry, 'findOrCreate').mockResolvedValue([
      { dataValues: { id: 70, dish: 'Porridge', recipe_id: 3 }, update: entryUpdate },
      false,
    ] as never);
    vi.spyOn(DailyMealEntry, 'destroy').mockResolvedValue(0 as never);
    vi.spyOn(DailyMealEntry, 'update').mockResolvedValue([0] as never);
    vi.spyOn(DailyMeal, 'update').mockResolvedValue([0] as never);
    return { subscription, slots, entryUpdate };
  };

  it('schedules the next day, freezes the live day, and leaves slots and later rows in place', async () => {
    const { subscription, slots, entryUpdate } = mockScheduleWorld();

    const result = await scheduleMealNamesReset(1, 10, '2024-06-15');

    expect(result).toEqual({ scheduled: true, applied: false, cleared: false });
    expect(subscription.update).toHaveBeenCalledWith(
      {
        meal_names_reset_effective_on: '2024-06-16',
        meal_names_reset_applied_at: null,
      },
      expect.anything()
    );
    expect(subscription.dataValues.meal_names_reset_effective_on).toBe('2024-06-16');

    const frozenMealIds = vi.mocked(DailyMealEntry.findOrCreate).mock.calls.map(
      (call) => (call[0] as { where: { daily_meal_id: number } }).where.daily_meal_id
    );
    expect(frozenMealIds).toEqual([15, 15, 15, 15]);
    expect(vi.mocked(DailyMealEntry.findOrCreate).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: { daily_meal_id: 15, meal_slot_id: 1 },
        defaults: expect.objectContaining({ name: 'Brekkie', position: 1, dish: null }),
      })
    );
    expect(entryUpdate).toHaveBeenCalledWith(
      { name: 'Brekkie', position: 1 },
      expect.anything()
    );
    for (const call of entryUpdate.mock.calls) {
      expect(call[0]).not.toHaveProperty('dish');
      expect(call[0]).not.toHaveProperty('recipe_id');
    }
    for (const slot of slots) {
      expect(slot.update).not.toHaveBeenCalled();
    }
    expect(DailyMealEntry.destroy).not.toHaveBeenCalled();
    expect(DailyMeal.update).not.toHaveBeenCalled();
    expect(sseService.emitFamilyEvent).toHaveBeenCalledWith(1, 'meal-slots-updated', {});
  });

  it('rejects a non-owner without writing', async () => {
    mockScheduleWorld();

    await expect(scheduleMealNamesReset(1, 99, '2024-06-15')).rejects.toBeInstanceOf(
      MealNamesResetForbiddenError
    );
    await expect(scheduleMealNamesReset(1, 99, '2024-06-15')).rejects.toThrow(
      'Only the family owner can reset meal names'
    );
    expect(Subscription.findOrCreate).not.toHaveBeenCalled();
    expect(Subscription.findOne).not.toHaveBeenCalled();
    expect(DailyMealEntry.findOrCreate).not.toHaveBeenCalled();
    expect(sseService.emitFamilyEvent).not.toHaveBeenCalled();
  });

  it('accepts today within one day of server UTC and rejects anything further', async () => {
    const yesterday = mockScheduleWorld();
    await scheduleMealNamesReset(1, 10, '2024-06-14');
    expect(yesterday.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ meal_names_reset_effective_on: '2024-06-15' }),
      expect.anything()
    );
    expect(DailyMealEntry.findOrCreate).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback: any) => callback({}));
    vi.spyOn(sseService, 'emitFamilyEvent').mockImplementation(() => {});
    const tomorrow = mockScheduleWorld();
    await scheduleMealNamesReset(1, 10, '2024-06-16');
    expect(tomorrow.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ meal_names_reset_effective_on: '2024-06-17' }),
      expect.anything()
    );
    const frozenMealIds = vi.mocked(DailyMealEntry.findOrCreate).mock.calls.map(
      (call) => (call[0] as { where: { daily_meal_id: number } }).where.daily_meal_id
    );
    expect(new Set(frozenMealIds)).toEqual(new Set([15, 16]));

    vi.restoreAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
    const transaction = vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback: any) =>
      callback({})
    );
    await expect(scheduleMealNamesReset(1, 10, '2024-06-13')).rejects.toBeInstanceOf(
      MealSlotsValidationError
    );
    await expect(scheduleMealNamesReset(1, 10, '2024-06-18')).rejects.toThrow(
      'today must be within one day'
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not move an existing pending effective date', async () => {
    const { subscription } = mockScheduleWorld(customSlots(), {
      meal_names_reset_effective_on: '2024-06-16',
    });

    const result = await scheduleMealNamesReset(1, 10, '2024-06-14');

    expect(result.scheduled).toBe(false);
    expect(subscription.update).not.toHaveBeenCalled();
    expect(subscription.dataValues.meal_names_reset_effective_on).toBe('2024-06-16');
    expect(DailyMealEntry.findOrCreate).not.toHaveBeenCalled();
    expect(sseService.emitFamilyEvent).not.toHaveBeenCalled();
  });

  it('rejects scheduling when the active slots are already the defaults', async () => {
    mockScheduleWorld([
      resetSlot({ id: 1, name: 'Breakfast', position: 1, legacy_key: 'breakfast' }),
      resetSlot({ id: 2, name: 'Lunch', position: 2, legacy_key: 'lunch' }),
      resetSlot({ id: 3, name: 'Dinner', position: 3, legacy_key: 'dinner' }),
    ]);

    await expect(scheduleMealNamesReset(1, 10, '2024-06-15')).rejects.toThrow(
      'Meal names already match the defaults'
    );
  });

  it('renders the custom template on the decision day and defaults from the effective day', async () => {
    const slots = customSlots();
    const subscription = subscriptionRow({ meal_names_reset_effective_on: '2024-06-16' });
    vi.spyOn(Subscription, 'findOne').mockResolvedValue(subscription as never);
    mockSlots(slots);
    vi.spyOn(DailyMealEntry, 'destroy').mockResolvedValue(0 as never);
    vi.spyOn(DailyMealEntry, 'findAll').mockResolvedValue([
      {
        dataValues: {
          id: 1,
          daily_meal_id: 14,
          meal_slot_id: 4,
          name: 'Snapshot Brunch',
          position: 4,
          dish: 'Old',
          recipe_id: null,
        },
      },
      {
        dataValues: {
          id: 2,
          daily_meal_id: 15,
          meal_slot_id: 1,
          name: 'OldBreakfast',
          position: 1,
          dish: 'Porridge',
          recipe_id: null,
        },
      },
      {
        dataValues: {
          id: 3,
          daily_meal_id: 15,
          meal_slot_id: 4,
          name: 'Snack',
          position: 4,
          dish: 'Crisps',
          recipe_id: null,
        },
      },
      {
        dataValues: {
          id: 4,
          daily_meal_id: 16,
          meal_slot_id: 1,
          name: 'Brekkie',
          position: 1,
          dish: 'Eggs',
          recipe_id: 9,
        },
      },
      {
        dataValues: {
          id: 5,
          daily_meal_id: 16,
          meal_slot_id: 2,
          name: 'Lunch',
          position: 2,
          dish: 'Soup',
          recipe_id: null,
        },
      },
      {
        dataValues: {
          id: 6,
          daily_meal_id: 16,
          meal_slot_id: 4,
          name: 'Snack',
          position: 4,
          dish: 'Crisps',
          recipe_id: null,
        },
      },
    ] as never);

    const active = await getActiveMealSlots(1);
    expect(active.map((slot) => slot.name)).toEqual(['Brekkie', 'Lunch', 'Dinner', 'Snack']);

    const slotsByDay = await buildDaySlotsForWeek(
      1,
      new Date('2024-06-10T12:00:00.000Z'),
      [
        { id: 14, day_of_week: 5 },
        { id: 15, day_of_week: 6 },
        { id: 16, day_of_week: 7 },
      ],
      new Date('2024-06-15T00:00:00.000Z')
    );

    expect(slotsByDay.get(5)).toEqual([
      expect.objectContaining({ name: 'Snapshot Brunch', position: 4, dish: 'Old' }),
    ]);
    expect(slotsByDay.get(6)?.map((slot) => ({ name: slot.name, dish: slot.dish }))).toEqual([
      { name: 'Brekkie', dish: 'Porridge' },
      { name: 'Lunch', dish: null },
      { name: 'Dinner', dish: null },
      { name: 'Snack', dish: 'Crisps' },
    ]);
    expect(slotsByDay.get(7)?.map((slot) => ({
      name: slot.name,
      position: slot.position,
      dish: slot.dish,
      recipe_id: slot.recipe_id,
      legacy_key: slot.legacy_key,
    }))).toEqual([
      { name: 'Breakfast', position: 1, dish: 'Eggs', recipe_id: 9, legacy_key: 'breakfast' },
      { name: 'Lunch', position: 2, dish: 'Soup', recipe_id: null, legacy_key: 'lunch' },
      { name: 'Dinner', position: 3, dish: null, recipe_id: null, legacy_key: 'dinner' },
    ]);
    expect(DailyMealEntry.destroy).not.toHaveBeenCalled();
  });

  it('applies keeper defaults, archives extra slots, and deletes extra entries only from the effective date', async () => {
    vi.setSystemTime(new Date('2024-06-16T12:00:00.000Z'));
    const slots = customSlots();
    const subscription = subscriptionRow({ meal_names_reset_effective_on: '2024-06-16' });
    vi.spyOn(Subscription, 'findOne').mockResolvedValue(subscription as never);
    mockSlots(slots);
    vi.spyOn(MealDiary, 'findAll').mockResolvedValue([
      { dataValues: { id: 1, week_start_date: '2024-06-10' } },
      { dataValues: { id: 2, week_start_date: '2024-06-17' } },
    ] as never);
    vi.spyOn(DailyMeal, 'findAll').mockResolvedValue([
      { dataValues: { id: 15, meal_diary_id: 1, day_of_week: 6 } },
      { dataValues: { id: 16, meal_diary_id: 1, day_of_week: 7 } },
      { dataValues: { id: 17, meal_diary_id: 2, day_of_week: 1 } },
    ] as never);
    vi.spyOn(DailyMealEntry, 'destroy').mockResolvedValue(1 as never);
    vi.spyOn(DailyMealEntry, 'update').mockResolvedValue([1] as never);
    vi.spyOn(DailyMeal, 'update').mockResolvedValue([0] as never);

    const result = await applyMealNamesResetIfDue(1);

    expect(result).toEqual({ applied: true, cleared: false });
    expect(slots[0].update).toHaveBeenCalledWith(
      { name: 'Breakfast', position: 1, archived_at: null },
      expect.anything()
    );
    expect(slots[1].update).toHaveBeenCalledWith(
      { name: 'Lunch', position: 2, archived_at: null },
      expect.anything()
    );
    expect(slots[2].update).toHaveBeenCalledWith(
      { name: 'Dinner', position: 3, archived_at: null },
      expect.anything()
    );
    expect(slots[3].update).toHaveBeenCalledWith(
      { archived_at: expect.any(Date) },
      expect.anything()
    );
    const destroyed = vi.mocked(DailyMealEntry.destroy).mock.calls[0][0] as {
      where: { daily_meal_id: { [Op.in]: number[] }; meal_slot_id: { [Op.notIn]: number[] } };
    };
    expect(destroyed.where.daily_meal_id[Op.in]).toEqual([16, 17]);
    expect(destroyed.where.meal_slot_id[Op.notIn]).toEqual([1, 2, 3]);
    expect(DailyMealEntry.update).toHaveBeenCalledWith(
      { name: 'Breakfast', position: 1 },
      expect.objectContaining({
        where: {
          daily_meal_id: { [Op.in]: [16, 17] },
          meal_slot_id: 1,
        },
      })
    );
    const breakfastUpdate = vi.mocked(DailyMealEntry.update).mock.calls.find(
      (call) => (call[1] as { where: { meal_slot_id: number } }).where.meal_slot_id === 1
    );
    expect(breakfastUpdate?.[0]).not.toHaveProperty('dish');
    expect(breakfastUpdate?.[0]).not.toHaveProperty('recipe_id');
    expect(subscription.update).toHaveBeenCalledWith(
      { meal_names_reset_applied_at: expect.any(Date) },
      expect.anything()
    );
    expect(DailyMeal.update).not.toHaveBeenCalled();
    expect(sseService.emitFamilyEvent).toHaveBeenCalledWith(1, 'meal-slots-updated', {});
  });

  it('creates a missing keeper slot during apply', async () => {
    vi.setSystemTime(new Date('2024-06-16T12:00:00.000Z'));
    const slots = [
      resetSlot({ id: 1, name: 'Brekkie', position: 1, legacy_key: 'breakfast' }),
      resetSlot({ id: 3, name: 'Dinner', position: 3, legacy_key: 'dinner' }),
    ];
    const subscription = subscriptionRow({ meal_names_reset_effective_on: '2024-06-16' });
    vi.spyOn(Subscription, 'findOne').mockResolvedValue(subscription as never);
    mockSlots(slots);
    vi.spyOn(MealDiary, 'findAll').mockResolvedValue([] as never);

    await applyMealNamesResetIfDue(1);

    expect(MealSlot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        family_group_id: 1,
        name: 'Lunch',
        position: 2,
        legacy_key: 'lunch',
        archived_at: null,
      }),
      expect.anything()
    );
  });

  it('aborts apply when the locked row is already premium', async () => {
    vi.setSystemTime(new Date('2024-06-16T12:00:00.000Z'));
    const expired = subscriptionRow({ meal_names_reset_effective_on: '2024-06-16' });
    const premium = subscriptionRow({
      id: 5,
      plan: 'premium',
      status: 'active',
      meal_names_reset_effective_on: '2024-06-16',
    });
    vi.spyOn(Subscription, 'findOne').mockImplementation(async (options: any) => {
      if (options?.transaction || options?.lock) {
        return premium as never;
      }
      return expired as never;
    });
    const findSlots = vi.spyOn(MealSlot, 'findAll').mockResolvedValue([] as never);
    vi.spyOn(DailyMealEntry, 'destroy').mockResolvedValue(0 as never);

    const result = await applyMealNamesResetIfDue(1);

    expect(result).toEqual({ applied: false, cleared: true });
    expect(premium.update).toHaveBeenCalledWith(
      {
        meal_names_reset_effective_on: null,
        meal_names_reset_applied_at: null,
      },
      expect.anything()
    );
    expect(expired.update).not.toHaveBeenCalled();
    expect(findSlots).not.toHaveBeenCalled();
    expect(DailyMealEntry.destroy).not.toHaveBeenCalled();
    expect(sseService.emitFamilyEvent).toHaveBeenCalledWith(1, 'meal-slots-updated', {});
  });

  it('clears a pending reset on renewal and leaves slots untouched', async () => {
    const subscription = subscriptionRow({
      plan: 'free',
      status: 'expired',
      meal_names_reset_effective_on: '2024-06-20',
    });
    vi.spyOn(Subscription, 'findOne').mockResolvedValue(subscription as never);
    vi.spyOn(MealSlot, 'findAll').mockResolvedValue([] as never);
    vi.spyOn(MealSlot, 'update').mockResolvedValue([0] as never);
    vi.spyOn(DailyMealEntry, 'destroy').mockResolvedValue(0 as never);
    vi.spyOn(DailyMealEntry, 'update').mockResolvedValue([0] as never);

    await updateSubscriptionClearingMealNamesResetWhenPremium(subscription as never, {
      plan: 'premium',
      status: 'active',
    });

    expect(subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'premium',
        status: 'active',
        meal_names_reset_effective_on: null,
        meal_names_reset_applied_at: null,
      }),
      expect.anything()
    );
    expect(MealSlot.findAll).not.toHaveBeenCalled();
    expect(MealSlot.update).not.toHaveBeenCalled();
    expect(DailyMealEntry.destroy).not.toHaveBeenCalled();
    expect(DailyMealEntry.update).not.toHaveBeenCalled();
  });

  it('clears an applied reset on renewal and does not restore old names', async () => {
    const subscription = subscriptionRow({
      plan: 'free',
      status: 'expired',
      meal_names_reset_effective_on: '2024-06-16',
      meal_names_reset_applied_at: new Date('2024-06-16T01:00:00.000Z'),
    });
    vi.spyOn(Subscription, 'findOne').mockResolvedValue(subscription as never);
    vi.spyOn(MealSlot, 'findAll').mockResolvedValue([] as never);
    vi.spyOn(MealSlot, 'create').mockResolvedValue({} as never);
    vi.spyOn(DailyMealEntry, 'destroy').mockResolvedValue(0 as never);
    vi.spyOn(DailyMealEntry, 'create').mockResolvedValue({} as never);

    await updateSubscriptionClearingMealNamesResetWhenPremium(subscription as never, {
      plan: 'premium',
      status: 'trialing',
      is_complimentary: false,
    });

    expect(subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        meal_names_reset_effective_on: null,
        meal_names_reset_applied_at: null,
      }),
      expect.anything()
    );
    expect(MealSlot.findAll).not.toHaveBeenCalled();
    expect(MealSlot.create).not.toHaveBeenCalled();
    expect(DailyMealEntry.destroy).not.toHaveBeenCalled();
    expect(DailyMealEntry.create).not.toHaveBeenCalled();
  });

  it('does not clear a pending reset when the sync result is payment_failed', async () => {
    const subscription = subscriptionRow({
      meal_names_reset_effective_on: '2024-06-20',
    });
    const findOne = vi.spyOn(Subscription, 'findOne');

    await updateSubscriptionClearingMealNamesResetWhenPremium(subscription as never, {
      plan: 'free',
      status: 'payment_failed',
    });

    expect(subscription.update).toHaveBeenCalledWith({
      plan: 'free',
      status: 'payment_failed',
    });
    expect(findOne).not.toHaveBeenCalled();
    expect(subscription.dataValues.meal_names_reset_effective_on).toBe('2024-06-20');
  });
});
