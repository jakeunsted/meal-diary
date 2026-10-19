import {
  mealDiarySlotValuesMatch,
  normalizeMealDiaryDish,
  type MealDiaryResolveSlot,
  type MealDiarySlotValue,
  type MealDiarySyncResult,
  type MealDiarySyncSlot,
  type MealDiarySyncStatus,
} from '@meal-diary/shared';
import { Op, Transaction } from 'sequelize';
import sequelize from '../db/models/index.ts';
import {
  DailyMeal,
  DailyMealEntry,
  MealDiary,
  Recipe,
} from '../db/models/associations.ts';
import { assertCanUpdateMealWeek } from './entitlements.service.ts';
import { getWeeklyMeals, type DailyMealWithDay } from './mealDiary.service.ts';
import {
  applySlotDishUpdates,
  getActiveMealSlots,
} from './mealSlots.service.ts';

const MAX_MEAL_DISH_LENGTH = 200;

export class MealDiarySyncValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MealDiarySyncValidationError';
  }
}

export interface MealDiarySyncAppliedDay {
  day_of_week: number;
  mealTypes: string[];
}

export interface MealDiarySyncServiceResult {
  dailyMeals: DailyMealWithDay[];
  results: MealDiarySyncResult[];
  appliedDays: MealDiarySyncAppliedDay[];
}

export interface SyncMealDiarySlotsInput {
  familyGroupId: number;
  userId: number;
  weekStartDate: Date;
  slots: MealDiarySyncSlot[];
}

export interface ResolveMealDiarySyncInput {
  familyGroupId: number;
  userId: number;
  weekStartDate: Date;
  keepMine: MealDiaryResolveSlot[];
}

interface ChangeSlot {
  day_of_week: number;
  meal_slot_id: number;
  dish: string | null;
  recipe_id: number | null;
  baseline: MealDiarySlotValue;
  reference: MealDiarySlotValue;
}

interface DayLock {
  dailyMealId: number;
  entries: Map<number, MealDiarySlotValue>;
}

const normalizeMealDiarySlotValue = (
  value: MealDiarySlotValue
): MealDiarySlotValue => ({
  dish: normalizeMealDiaryDish(value.dish),
  recipe_id: value.recipe_id ?? null,
});

const parseRecipeId = (value: unknown): number | null => {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  throw new MealDiarySyncValidationError(
    'recipe_id must be a positive integer or null'
  );
};

const parseDish = (value: unknown): string | null => {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new MealDiarySyncValidationError('dish must be a string or null');
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_MEAL_DISH_LENGTH) {
    throw new MealDiarySyncValidationError(
      'dish must be 200 characters or fewer'
    );
  }
  return trimmed.length === 0 ? null : trimmed;
};

const parseDayOfWeek = (value: unknown): number => {
  const day =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^-?\d+$/.test(value)
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isInteger(day) || day < 1 || day > 7) {
    throw new MealDiarySyncValidationError(
      'day_of_week must be between 1 and 7'
    );
  }
  return day;
};

const parseMealSlotId = (value: unknown): number => {
  const id =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isInteger(id) || id <= 0) {
    throw new MealDiarySyncValidationError(
      'meal_slot_id must be a positive integer'
    );
  }
  return id;
};

const parseSlotValue = (value: unknown, label: string): MealDiarySlotValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MealDiarySyncValidationError(`${label} is required`);
  }
  const record = value as Record<string, unknown>;
  return {
    dish: parseDish(record.dish),
    recipe_id: parseRecipeId(record.recipe_id),
  };
};

const parseChangeRecord = (value: unknown, invalidMessage: string): ChangeSlot => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MealDiarySyncValidationError(invalidMessage);
  }
  const record = value as Record<string, unknown>;
  const baseline = parseSlotValue(record.baseline, 'baseline');
  return {
    day_of_week: parseDayOfWeek(record.day_of_week),
    meal_slot_id: parseMealSlotId(record.meal_slot_id),
    dish: parseDish(record.dish),
    recipe_id: parseRecipeId(record.recipe_id),
    baseline,
    reference: baseline,
  };
};

export const parseMealDiarySyncSlots = (slots: unknown): MealDiarySyncSlot[] => {
  if (!Array.isArray(slots)) {
    throw new MealDiarySyncValidationError('slots must be an array');
  }

  return slots.map((slot) => {
    const change = parseChangeRecord(slot, 'Invalid slot');
    return {
      day_of_week: change.day_of_week,
      meal_slot_id: change.meal_slot_id,
      baseline: change.baseline,
      dish: change.dish,
      recipe_id: change.recipe_id,
    };
  });
};

export const parseMealDiaryResolveSlots = (
  keepMine: unknown
): MealDiaryResolveSlot[] => {
  if (!Array.isArray(keepMine)) {
    throw new MealDiarySyncValidationError('keep_mine must be an array');
  }

  return keepMine.map((slot) => {
    const change = parseChangeRecord(slot, 'Invalid keep_mine slot');
    const record = slot as Record<string, unknown>;
    return {
      day_of_week: change.day_of_week,
      meal_slot_id: change.meal_slot_id,
      dish: change.dish,
      recipe_id: change.recipe_id,
      expected: parseSlotValue(record.expected, 'expected'),
      baseline: change.baseline,
    };
  });
};

const plainResult = (
  slot: ChangeSlot,
  status: Exclude<MealDiarySyncStatus, 'conflict'>
): MealDiarySyncResult => ({
  day_of_week: slot.day_of_week,
  meal_slot_id: slot.meal_slot_id,
  status,
});

const lockDiaryDay = async (
  mealDiaryId: number,
  dayOfWeek: number,
  transaction: Transaction
): Promise<DayLock> => {
  const [dailyMeal] = await DailyMeal.findOrCreate({
    where: {
      meal_diary_id: mealDiaryId,
      day_of_week: dayOfWeek,
    },
    defaults: {
      meal_diary_id: mealDiaryId,
      day_of_week: dayOfWeek,
    },
    transaction,
  });

  const lockedDay = await DailyMeal.findOne({
    where: { id: dailyMeal.dataValues.id },
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });
  if (!lockedDay) {
    throw new Error('Daily meal not found for this week');
  }

  const rows = await DailyMealEntry.findAll({
    where: { daily_meal_id: lockedDay.dataValues.id },
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });

  const entries = new Map<number, MealDiarySlotValue>();
  for (const row of rows) {
    entries.set(row.dataValues.meal_slot_id, {
      dish: normalizeMealDiaryDish(row.dataValues.dish),
      recipe_id: row.dataValues.recipe_id ?? null,
    });
  }

  return {
    dailyMealId: lockedDay.dataValues.id,
    entries,
  };
};

const applyMealDiaryChanges = async (
  familyGroupId: number,
  userId: number,
  weekStartDate: Date,
  changes: ChangeSlot[]
): Promise<MealDiarySyncServiceResult> => {
  await assertCanUpdateMealWeek(familyGroupId, userId, weekStartDate);

  if (changes.length === 0) {
    const dailyMeals = await getWeeklyMeals(familyGroupId, weekStartDate);
    return { dailyMeals, results: [], appliedDays: [] };
  }

  const results: MealDiarySyncResult[] = [];
  const mealTypesByDay = new Map<number, string[]>();

  await sequelize.transaction(async (transaction) => {
    const activeSlots = await getActiveMealSlots(familyGroupId, transaction);
    const activeById = new Map(activeSlots.map((slot) => [slot.id, slot]));

    const recipeIds = [
      ...new Set(
        changes
          .map((slot) => slot.recipe_id)
          .filter((id): id is number => typeof id === 'number')
      ),
    ];
    const allowedRecipeIds = new Set<number>();
    if (recipeIds.length > 0) {
      const recipes = await Recipe.findAll({
        where: {
          id: { [Op.in]: recipeIds },
          family_group_id: familyGroupId,
        },
        attributes: ['id'],
        transaction,
      });
      for (const recipe of recipes) {
        allowedRecipeIds.add(recipe.dataValues.id);
      }
    }

    const [mealDiary] = await MealDiary.findOrCreate({
      where: {
        family_group_id: familyGroupId,
        week_start_date: weekStartDate,
      },
      defaults: {
        family_group_id: familyGroupId,
        week_start_date: weekStartDate,
      },
      transaction,
    });

    const dayNumbers = [
      ...new Set(changes.map((slot) => slot.day_of_week)),
    ].sort((left, right) => left - right);
    const dayLocks = new Map<number, DayLock>();
    for (const dayOfWeek of dayNumbers) {
      dayLocks.set(
        dayOfWeek,
        await lockDiaryDay(mealDiary.dataValues.id, dayOfWeek, transaction)
      );
    }

    for (const slot of changes) {
      const active = activeById.get(slot.meal_slot_id);
      if (!active) {
        results.push(plainResult(slot, 'slot_removed'));
        continue;
      }

      if (slot.recipe_id != null && !allowedRecipeIds.has(slot.recipe_id)) {
        results.push(plainResult(slot, 'recipe_rejected'));
        continue;
      }

      const dayLock = dayLocks.get(slot.day_of_week);
      if (!dayLock) {
        throw new Error('Daily meal not found for this week');
      }

      const server = dayLock.entries.get(slot.meal_slot_id) ?? {
        dish: null,
        recipe_id: null,
      };
      const yours: MealDiarySlotValue = {
        dish: normalizeMealDiaryDish(slot.dish),
        recipe_id: slot.recipe_id ?? null,
      };
      const baseline = normalizeMealDiarySlotValue(slot.baseline);

      if (mealDiarySlotValuesMatch(yours, server)) {
        results.push(plainResult(slot, 'already_saved'));
        continue;
      }

      if (mealDiarySlotValuesMatch(server, slot.reference)) {
        await applySlotDishUpdates(
          familyGroupId,
          dayLock.dailyMealId,
          [
            {
              meal_slot_id: slot.meal_slot_id,
              dish: yours.dish,
              recipe_id: yours.recipe_id,
            },
          ],
          transaction
        );
        dayLock.entries.set(slot.meal_slot_id, yours);
        const mealTypes = mealTypesByDay.get(slot.day_of_week) ?? [];
        mealTypes.push(active.legacy_key ?? `slot_${active.id}`);
        mealTypesByDay.set(slot.day_of_week, mealTypes);
        results.push(plainResult(slot, 'applied'));
        continue;
      }

      results.push({
        day_of_week: slot.day_of_week,
        meal_slot_id: slot.meal_slot_id,
        status: 'conflict',
        yours,
        theirs: server,
        baseline,
      });
    }
  });

  const dailyMeals = await getWeeklyMeals(familyGroupId, weekStartDate);
  const appliedDays = [...mealTypesByDay.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([day_of_week, mealTypes]) => ({ day_of_week, mealTypes }));

  return { dailyMeals, results, appliedDays };
};

const toChangeSlot = (slot: MealDiarySyncSlot): ChangeSlot => {
  const baseline = normalizeMealDiarySlotValue(slot.baseline);
  return {
    day_of_week: slot.day_of_week,
    meal_slot_id: slot.meal_slot_id,
    dish: normalizeMealDiaryDish(slot.dish),
    recipe_id: slot.recipe_id ?? null,
    baseline,
    reference: baseline,
  };
};

export const syncMealDiarySlots = async (
  input: SyncMealDiarySlotsInput
): Promise<MealDiarySyncServiceResult> =>
  applyMealDiaryChanges(
    input.familyGroupId,
    input.userId,
    input.weekStartDate,
    input.slots.map(toChangeSlot)
  );

export const resolveMealDiarySync = async (
  input: ResolveMealDiarySyncInput
): Promise<MealDiarySyncServiceResult> =>
  applyMealDiaryChanges(
    input.familyGroupId,
    input.userId,
    input.weekStartDate,
    input.keepMine.map((slot) => ({
      day_of_week: slot.day_of_week,
      meal_slot_id: slot.meal_slot_id,
      dish: normalizeMealDiaryDish(slot.dish),
      recipe_id: slot.recipe_id ?? null,
      baseline: normalizeMealDiarySlotValue(slot.baseline),
      reference: normalizeMealDiarySlotValue(slot.expected),
    }))
  );
