import {
  DEFAULT_LEGACY_MEAL_KEYS,
  DEFAULT_MEAL_SLOT_NAMES,
  diffMealSlots,
  normalizeMealSlotName,
  validateMealSlotNames,
  type LegacyMealKey,
  type MealSlotInput,
  type RemovedSlotImpact,
} from '@meal-diary/shared';
import { Op, Transaction } from 'sequelize';
import sequelize from '../db/models/index.ts';
import {
  DailyMeal,
  DailyMealEntry,
  FamilyGroup,
  MealDiary,
  MealSlot,
  Recipe,
  Subscription,
} from '../db/models/associations.ts';
import type { SubscriptionAttributes } from '../db/models/Subscription.model.ts';
import { emitFamilyEvent } from './sse.service.ts';

export const RECIPE_NOT_IN_FAMILY_MESSAGE =
  'Recipe does not belong to this family group';

/**
 * Ensure every non-null recipe id belongs to the given family.
 * Null/undefined clears a recipe and are allowed.
 */
export const assertRecipesBelongToFamily = async (
  familyGroupId: number,
  recipeIds: Array<number | null | undefined>
): Promise<void> => {
  const ids = [
    ...new Set(
      recipeIds.filter(
        (id): id is number =>
          typeof id === 'number' && Number.isInteger(id) && id > 0
      )
    ),
  ];

  if (ids.length === 0) {
    return;
  }

  const matchingCount = await Recipe.count({
    where: {
      id: { [Op.in]: ids },
      family_group_id: familyGroupId,
    },
  });

  if (matchingCount !== ids.length) {
    throw new Error(RECIPE_NOT_IN_FAMILY_MESSAGE);
  }
};

export interface MealSlotDto {
  id: number;
  name: string;
  position: number;
  legacy_key: LegacyMealKey | null;
}

export interface DayMealSlotDto {
  id: number;
  meal_slot_id: number;
  name: string;
  position: number;
  dish: string | null;
  recipe_id: number | null;
  legacy_key: LegacyMealKey | null;
}

export class MealSlotsConfirmationRequiredError extends Error {
  readonly code = 'MEAL_SLOTS_CONFIRMATION_REQUIRED';
  readonly removed: RemovedSlotImpact[];

  constructor(removed: RemovedSlotImpact[]) {
    super('MEAL_SLOTS_CONFIRMATION_REQUIRED');
    this.name = 'MealSlotsConfirmationRequiredError';
    this.removed = removed;
  }
}

export class MealSlotsValidationError extends Error {
  readonly code = 'MEAL_SLOTS_VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'MealSlotsValidationError';
  }
}

export class MealNamesResetForbiddenError extends Error {
  readonly code = 'MEAL_NAMES_RESET_FORBIDDEN';

  constructor() {
    super('Only the family owner can reset meal names');
    this.name = 'MealNamesResetForbiddenError';
  }
}

const MEAL_NAMES_RESET_STATUS_MESSAGE =
  'Meal names can only be reset after Family Plus has ended';
const MEAL_NAMES_RESET_COMPLIMENTARY_MESSAGE =
  'Complimentary families cannot reset meal names';
const MEAL_NAMES_RESET_ALREADY_DEFAULT_MESSAGE =
  'Meal names already match the defaults';

export interface MealNamesResetColumns {
  meal_names_reset_effective_on?: string | Date | null;
  meal_names_reset_applied_at?: Date | string | null;
}

export interface MealNamesResetApplyResult {
  applied: boolean;
  cleared: boolean;
}

export interface ScheduleMealNamesResetResult {
  scheduled: boolean;
  applied: boolean;
  cleared: boolean;
}

const mealNamesResetNoop = (): MealNamesResetApplyResult => ({
  applied: false,
  cleared: false,
});

const dateOnlyString = (value: unknown): string | null => {
  if (value == null || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return formatDateOnly(value);
  }
  if (typeof value === 'string') {
    const sliced = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(sliced) ? sliced : null;
  }
  return null;
};

const serverUtcTodayString = (): string => formatDateOnly(new Date());

const addUtcDays = (date: Date, days: number): string =>
  formatDateOnly(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))
  );

export const isPremiumSubscriptionState = (
  subscription: Pick<SubscriptionAttributes, 'plan' | 'status' | 'is_complimentary'>
): boolean => {
  if (subscription.is_complimentary) {
    return true;
  }

  return (
    subscription.plan === 'premium' &&
    (subscription.status === 'active' || subscription.status === 'trialing')
  );
};

export const isPendingMealNamesReset = (
  values: MealNamesResetColumns | null | undefined,
  serverToday: string = serverUtcTodayString()
): boolean => {
  const effectiveOn = dateOnlyString(values?.meal_names_reset_effective_on);
  if (!effectiveOn || values?.meal_names_reset_applied_at) {
    return false;
  }
  return serverToday < effectiveOn;
};

const isMealNamesResetDue = (
  values: MealNamesResetColumns | null | undefined,
  serverToday: string
): boolean => {
  const effectiveOn = dateOnlyString(values?.meal_names_reset_effective_on);
  if (!effectiveOn || values?.meal_names_reset_applied_at) {
    return false;
  }
  return serverToday >= effectiveOn;
};

const slotsMatchDefaults = (
  slots: Array<{ name: string; position: number }>
): boolean => {
  if (slots.length !== DEFAULT_MEAL_SLOT_NAMES.length) {
    return false;
  }
  const ordered = [...slots].sort((a, b) => a.position - b.position);
  return ordered.every(
    (slot, index) => normalizeMealSlotName(slot.name) === DEFAULT_MEAL_SLOT_NAMES[index]
  );
};

const preferKeeperSlot = (current: MealSlot | undefined, slot: MealSlot): MealSlot => {
  if (!current) {
    return slot;
  }
  if (current.dataValues.archived_at && !slot.dataValues.archived_at) {
    return slot;
  }
  return current;
};

const formatDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const parseDateOnly = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new MealSlotsValidationError('Invalid today date format');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
};

export const assertTodayWithinSkew = (today: string, referenceUtc: Date = new Date()): Date => {
  const clientDay = parseDateOnly(today);
  const serverDay = parseDateOnly(formatDateOnly(referenceUtc));
  const diffDays = Math.abs(
    (clientDay.getTime() - serverDay.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays > 1) {
    throw new MealSlotsValidationError('today must be within one day of the server date');
  }
  return clientDay;
};

/** Calendar date (UTC midnight) for a diary day. week_start is Monday; day_of_week 1–7. */
export const calendarDateForDiaryDay = (
  weekStartDate: string | Date,
  dayOfWeek: number
): Date => {
  const weekStart =
    typeof weekStartDate === 'string'
      ? parseDateOnly(weekStartDate.slice(0, 10))
      : parseDateOnly(formatDateOnly(new Date(weekStartDate)));
  const date = new Date(weekStart);
  date.setUTCDate(date.getUTCDate() + (dayOfWeek - 1));
  return date;
};

export const isDateOnOrAfter = (date: Date, today: Date): boolean =>
  date.getTime() >= today.getTime();

const toSlotDto = (slot: MealSlot): MealSlotDto => ({
  id: slot.dataValues.id,
  name: slot.dataValues.name,
  position: slot.dataValues.position,
  legacy_key: (slot.dataValues.legacy_key as LegacyMealKey | null) ?? null,
});

export const ensureDefaultMealSlots = async (
  familyGroupId: number,
  transaction?: Transaction
): Promise<MealSlot[]> => {
  const existing = await MealSlot.findAll({
    where: { family_group_id: familyGroupId },
    order: [['position', 'ASC']],
    transaction,
  });

  if (existing.length > 0) {
    return existing;
  }

  const created = await MealSlot.bulkCreate(
    DEFAULT_MEAL_SLOT_NAMES.map((name, index) => ({
      family_group_id: familyGroupId,
      position: index + 1,
      name,
      legacy_key: DEFAULT_LEGACY_MEAL_KEYS[index],
      archived_at: null,
    })),
    { transaction }
  );

  return created;
};

export const getActiveMealSlots = async (
  familyGroupId: number,
  transaction?: Transaction
): Promise<MealSlotDto[]> => {
  if (!transaction) {
    await applyMealNamesResetIfDue(familyGroupId);
  }
  await ensureDefaultMealSlots(familyGroupId, transaction);
  const slots = await MealSlot.findAll({
    where: {
      family_group_id: familyGroupId,
      archived_at: null,
    },
    order: [['position', 'ASC']],
    transaction,
  });
  return slots.map(toSlotDto);
};

const entryHasContent = (dish: string | null | undefined, recipeId: number | null | undefined) =>
  Boolean((dish && dish.trim()) || recipeId);

/** Daily meal row ids whose calendar date matches the predicate, using the family's diaries. */
const loadDailyMealIds = async (
  familyGroupId: number,
  includeDate: (date: Date) => boolean,
  transaction?: Transaction
): Promise<number[]> => {
  const diaries = await MealDiary.findAll({
    where: { family_group_id: familyGroupId },
    attributes: ['id', 'week_start_date'],
    transaction,
  });
  if (diaries.length === 0) {
    return [];
  }

  const diaryById = new Map(
    diaries.map((d) => [d.dataValues.id, String(d.dataValues.week_start_date).slice(0, 10)])
  );
  const dailyMeals = await DailyMeal.findAll({
    where: { meal_diary_id: { [Op.in]: [...diaryById.keys()] } },
    attributes: ['id', 'meal_diary_id', 'day_of_week'],
    transaction,
  });

  const ids: number[] = [];
  for (const meal of dailyMeals) {
    const weekStart = diaryById.get(meal.dataValues.meal_diary_id);
    if (!weekStart) continue;
    const date = calendarDateForDiaryDay(weekStart, meal.dataValues.day_of_week);
    if (includeDate(date)) {
      ids.push(meal.dataValues.id);
    }
  }
  return ids;
};

/** Daily meal row ids for calendar days on/after today across the family's diaries. */
const loadFutureDailyMealIds = async (
  familyGroupId: number,
  today: Date,
  transaction?: Transaction
): Promise<number[]> =>
  loadDailyMealIds(familyGroupId, (date) => isDateOnOrAfter(date, today), transaction);

/**
 * Count future (today+) daily meal entries with content for the given slot ids.
 */
export const countFutureContentBySlotId = async (
  familyGroupId: number,
  slotIds: number[],
  today: Date,
  transaction?: Transaction
): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const id of slotIds) {
    counts[String(id)] = 0;
  }
  if (slotIds.length === 0) {
    return counts;
  }

  const futureDailyMealIds = await loadFutureDailyMealIds(familyGroupId, today, transaction);
  if (futureDailyMealIds.length === 0) {
    return counts;
  }

  const entries = await DailyMealEntry.findAll({
    where: {
      daily_meal_id: { [Op.in]: futureDailyMealIds },
      meal_slot_id: { [Op.in]: slotIds },
    },
    attributes: ['meal_slot_id', 'dish', 'recipe_id'],
    transaction,
  });

  for (const entry of entries) {
    if (entryHasContent(entry.dataValues.dish, entry.dataValues.recipe_id)) {
      const key = String(entry.dataValues.meal_slot_id);
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return counts;
};

/**
 * Backfill default slots for every family and copy legacy columns into entries.
 * Idempotent: never updates daily_meals rows.
 */
export const backfillMealSlots = async (): Promise<{
  familiesEnsured: number;
  entriesCreated: number;
}> => {
  const families = await FamilyGroup.findAll({ attributes: ['id'] });
  let entriesCreated = 0;

  for (const family of families) {
    const familyGroupId = family.dataValues.id;
    const slots = await ensureDefaultMealSlots(familyGroupId);
    const slotsByLegacy = new Map(
      slots
        .filter((s) => s.dataValues.legacy_key)
        .map((s) => [s.dataValues.legacy_key as LegacyMealKey, s])
    );

    const diaries = await MealDiary.findAll({
      where: { family_group_id: familyGroupId },
      attributes: ['id'],
    });
    if (diaries.length === 0) continue;

    const dailyMeals = await DailyMeal.findAll({
      where: { meal_diary_id: { [Op.in]: diaries.map((d) => d.dataValues.id) } },
      attributes: [
        'id',
        'breakfast',
        'lunch',
        'dinner',
        'breakfast_recipe_id',
        'lunch_recipe_id',
        'dinner_recipe_id',
      ],
    });

    for (const meal of dailyMeals) {
      const existing = await DailyMealEntry.findAll({
        where: { daily_meal_id: meal.dataValues.id },
        attributes: ['meal_slot_id'],
      });
      const existingSlotIds = new Set(existing.map((e) => e.dataValues.meal_slot_id));

      for (const legacyKey of DEFAULT_LEGACY_MEAL_KEYS) {
        const slot = slotsByLegacy.get(legacyKey);
        if (!slot || existingSlotIds.has(slot.dataValues.id)) continue;

        const dish =
          (meal.dataValues[legacyKey] as string | null | undefined) ?? null;
        const recipeId =
          (meal.dataValues[`${legacyKey}_recipe_id` as const] as number | null | undefined) ??
          null;

        await DailyMealEntry.create({
          daily_meal_id: meal.dataValues.id,
          meal_slot_id: slot.dataValues.id,
          name: slot.dataValues.name,
          position: slot.dataValues.position,
          dish: dish || null,
          recipe_id: recipeId,
        });
        entriesCreated += 1;
      }
    }
  }

  return { familiesEnsured: families.length, entriesCreated };
};

const clearLegacyColumnOnDailyMeal = async (
  dailyMealId: number,
  legacyKey: LegacyMealKey,
  transaction: Transaction
): Promise<void> => {
  await DailyMeal.update(
    {
      [legacyKey]: '',
      [`${legacyKey}_recipe_id`]: null,
    } as any,
    { where: { id: dailyMealId }, transaction }
  );
};

export interface ReplaceMealSlotsResult {
  slots: MealSlotDto[];
}

export const replaceMealSlots = async (
  familyGroupId: number,
  proposed: MealSlotInput[],
  todayStr: string,
  confirm: boolean
): Promise<ReplaceMealSlotsResult> => {
  const validation = validateMealSlotNames(proposed);
  if (!validation.ok) {
    throw new MealSlotsValidationError('Invalid meal slot names');
  }

  const today = assertTodayWithinSkew(todayStr);

  return sequelize.transaction(async (transaction) => {
    await ensureDefaultMealSlots(familyGroupId, transaction);
    const currentSlots = await MealSlot.findAll({
      where: { family_group_id: familyGroupId, archived_at: null },
      order: [['position', 'ASC']],
      transaction,
    });
    const currentDtos = currentSlots.map(toSlotDto);

    const slotIds = currentDtos.map((s) => s.id);
    const futureContentBySlotId = await countFutureContentBySlotId(
      familyGroupId,
      slotIds,
      today,
      transaction
    );

    const diff = diffMealSlots(currentDtos, proposed, { futureContentBySlotId });

    if (diff.requiresConfirmation && !confirm) {
      throw new MealSlotsConfirmationRequiredError(diff.removed);
    }

    const now = new Date();
    const currentById = new Map(currentSlots.map((s) => [s.dataValues.id, s]));
    const futureDailyMealIds =
      diff.removed.length > 0
        ? await loadFutureDailyMealIds(familyGroupId, today, transaction)
        : [];

    // Archive removed slots and delete future entries
    for (const removed of diff.removed) {
      const slot = currentById.get(Number(removed.id));
      if (!slot) continue;

      await slot.update({ archived_at: now }, { transaction });

      if (futureDailyMealIds.length > 0) {
        await DailyMealEntry.destroy({
          where: {
            daily_meal_id: { [Op.in]: futureDailyMealIds },
            meal_slot_id: slot.dataValues.id,
          },
          transaction,
        });

        if (slot.dataValues.legacy_key) {
          for (const dailyMealId of futureDailyMealIds) {
            await clearLegacyColumnOnDailyMeal(
              dailyMealId,
              slot.dataValues.legacy_key as LegacyMealKey,
              transaction
            );
          }
        }
      }
    }

    // Apply proposed order: update existing, create new
    for (let index = 0; index < proposed.length; index += 1) {
      const input = proposed[index];
      const position = index + 1;
      const name = normalizeMealSlotName(input.name);
      const existingId =
        input.id != null && input.id !== '' ? Number(input.id) : NaN;
      const existing =
        Number.isFinite(existingId) && !Number.isNaN(existingId)
          ? currentById.get(existingId)
          : undefined;

      if (existing && existing.dataValues.archived_at == null) {
        const nameChanged = existing.dataValues.name !== name;
        const positionChanged = existing.dataValues.position !== position;
        if (nameChanged || positionChanged) {
          await existing.update({ name, position }, { transaction });
          await updateFutureEntrySnapshots(
            familyGroupId,
            existing.dataValues.id,
            name,
            position,
            today,
            transaction
          );
        }
      } else {
        await MealSlot.create(
          {
            family_group_id: familyGroupId,
            name,
            position,
            legacy_key: null,
            archived_at: null,
          },
          { transaction }
        );
      }
    }

    return {
      slots: await getActiveMealSlots(familyGroupId, transaction),
    };
  });
};

const updateFutureEntrySnapshots = async (
  familyGroupId: number,
  mealSlotId: number,
  name: string,
  position: number,
  today: Date,
  transaction: Transaction
): Promise<void> => {
  const futureIds = await loadFutureDailyMealIds(familyGroupId, today, transaction);
  if (futureIds.length === 0) return;

  await DailyMealEntry.update(
    { name, position },
    {
      where: {
        daily_meal_id: { [Op.in]: futureIds },
        meal_slot_id: mealSlotId,
      },
      transaction,
    }
  );
};

/**
 * Mirror legacy breakfast/lunch/dinner column writes into daily_meal_entries.
 * Does not clear non-legacy slots.
 */
export const syncLegacyColumnsToEntries = async (
  familyGroupId: number,
  dailyMealId: number,
  updates: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    breakfast_recipe_id?: number | null;
    lunch_recipe_id?: number | null;
    dinner_recipe_id?: number | null;
  },
  transaction?: Transaction
): Promise<void> => {
  const slots = await ensureDefaultMealSlots(familyGroupId, transaction);
  const byLegacy = new Map(
    slots
      .filter((s) => s.dataValues.legacy_key && !s.dataValues.archived_at)
      .map((s) => [s.dataValues.legacy_key as LegacyMealKey, s])
  );

  for (const legacyKey of DEFAULT_LEGACY_MEAL_KEYS) {
    const dishKey = legacyKey;
    const recipeKey = `${legacyKey}_recipe_id` as const;
    if (!(dishKey in updates) && !(recipeKey in updates)) {
      continue;
    }

    const slot = byLegacy.get(legacyKey);
    if (!slot) continue;

    const dish =
      dishKey in updates
        ? ((updates[dishKey] as string | null | undefined) ?? null)
        : undefined;
    const recipeId =
      recipeKey in updates
        ? ((updates[recipeKey] as number | null | undefined) ?? null)
        : undefined;

    const [entry] = await DailyMealEntry.findOrCreate({
      where: {
        daily_meal_id: dailyMealId,
        meal_slot_id: slot.dataValues.id,
      },
      defaults: {
        daily_meal_id: dailyMealId,
        meal_slot_id: slot.dataValues.id,
        name: slot.dataValues.name,
        position: slot.dataValues.position,
        dish: dish === undefined ? null : dish || null,
        recipe_id: recipeId === undefined ? null : recipeId,
      },
      transaction,
    });

    const patch: Record<string, unknown> = {
      name: slot.dataValues.name,
      position: slot.dataValues.position,
    };
    if (dish !== undefined) {
      patch.dish = dish || null;
    }
    if (recipeId !== undefined) {
      patch.recipe_id = recipeId;
    }
    await entry.update(patch, { transaction });
  }
};

const clearMealNamesResetColumns = async (
  subscription: Subscription,
  transaction: Transaction
): Promise<void> => {
  await subscription.update(
    {
      meal_names_reset_effective_on: null,
      meal_names_reset_applied_at: null,
    },
    { transaction }
  );
};

const freezeMealNameSnapshots = async (
  familyGroupId: number,
  effectiveOn: string,
  transaction: Transaction
): Promise<void> => {
  const serverToday = parseDateOnly(serverUtcTodayString());
  const effectiveDate = parseDateOnly(effectiveOn);
  const dailyMealIds = await loadDailyMealIds(
    familyGroupId,
    (date) => isDateOnOrAfter(date, serverToday) && date.getTime() < effectiveDate.getTime(),
    transaction
  );
  if (dailyMealIds.length === 0) {
    return;
  }

  const activeSlots = await MealSlot.findAll({
    where: { family_group_id: familyGroupId, archived_at: null },
    transaction,
  });

  for (const dailyMealId of dailyMealIds) {
    for (const slot of activeSlots) {
      const [entry] = await DailyMealEntry.findOrCreate({
        where: {
          daily_meal_id: dailyMealId,
          meal_slot_id: slot.dataValues.id,
        },
        defaults: {
          daily_meal_id: dailyMealId,
          meal_slot_id: slot.dataValues.id,
          name: slot.dataValues.name,
          position: slot.dataValues.position,
          dish: null,
          recipe_id: null,
        },
        transaction,
      });
      await entry.update(
        {
          name: slot.dataValues.name,
          position: slot.dataValues.position,
        },
        { transaction }
      );
    }
  }
};

const applyMealNamesResetLocked = async (
  familyGroupId: number,
  transaction: Transaction,
  lockedSubscription?: Subscription
): Promise<MealNamesResetApplyResult> => {
  const subscription =
    lockedSubscription ??
    (await Subscription.findOne({
      where: { family_group_id: familyGroupId },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    }));
  if (!subscription) {
    return mealNamesResetNoop();
  }

  const serverToday = serverUtcTodayString();
  if (!isMealNamesResetDue(subscription.dataValues, serverToday)) {
    return mealNamesResetNoop();
  }

  if (isPremiumSubscriptionState(subscription.dataValues)) {
    await clearMealNamesResetColumns(subscription, transaction);
    return { applied: false, cleared: true };
  }

  const slots = await MealSlot.findAll({
    where: { family_group_id: familyGroupId },
    transaction,
  });
  const keeperByKey = new Map<LegacyMealKey, MealSlot>();
  for (const slot of slots) {
    const legacyKey = slot.dataValues.legacy_key as LegacyMealKey | null;
    if (!legacyKey || !DEFAULT_LEGACY_MEAL_KEYS.includes(legacyKey)) {
      continue;
    }
    keeperByKey.set(legacyKey, preferKeeperSlot(keeperByKey.get(legacyKey), slot));
  }

  const now = new Date();
  const keeperIds: number[] = [];
  for (let index = 0; index < DEFAULT_LEGACY_MEAL_KEYS.length; index += 1) {
    const legacyKey = DEFAULT_LEGACY_MEAL_KEYS[index];
    const name = DEFAULT_MEAL_SLOT_NAMES[index];
    const position = index + 1;
    let keeper = keeperByKey.get(legacyKey);
    if (!keeper) {
      keeper = await MealSlot.create(
        {
          family_group_id: familyGroupId,
          name,
          position,
          legacy_key: legacyKey,
          archived_at: null,
        },
        { transaction }
      );
    } else {
      await keeper.update(
        {
          name,
          position,
          archived_at: null,
        },
        { transaction }
      );
    }
    keeperIds.push(keeper.dataValues.id);
  }

  const keeperIdSet = new Set(keeperIds);
  for (const slot of slots) {
    if (keeperIdSet.has(slot.dataValues.id) || slot.dataValues.archived_at != null) {
      continue;
    }
    await slot.update({ archived_at: now }, { transaction });
  }

  const effectiveOn = dateOnlyString(subscription.dataValues.meal_names_reset_effective_on);
  if (!effectiveOn) {
    return mealNamesResetNoop();
  }

  const dailyMealIds = await loadDailyMealIds(
    familyGroupId,
    (date) => formatDateOnly(date) >= effectiveOn,
    transaction
  );
  if (dailyMealIds.length > 0) {
    await DailyMealEntry.destroy({
      where: {
        daily_meal_id: { [Op.in]: dailyMealIds },
        meal_slot_id: { [Op.notIn]: keeperIds },
      },
      transaction,
    });

    for (let index = 0; index < keeperIds.length; index += 1) {
      await DailyMealEntry.update(
        {
          name: DEFAULT_MEAL_SLOT_NAMES[index],
          position: index + 1,
        },
        {
          where: {
            daily_meal_id: { [Op.in]: dailyMealIds },
            meal_slot_id: keeperIds[index],
          },
          transaction,
        }
      );
    }
  }

  await subscription.update(
    {
      meal_names_reset_applied_at: now,
    },
    { transaction }
  );

  return { applied: true, cleared: false };
};

const emitMealSlotsUpdated = (familyGroupId: number): void => {
  emitFamilyEvent(familyGroupId, 'meal-slots-updated', {});
};

/**
 * Apply a due meal-name reset. Reads call this before returning slots.
 */
export const applyMealNamesResetIfDue = async (
  familyGroupId: number,
  options?: {
    transaction?: Transaction;
    lockedSubscription?: Subscription;
    hint?: MealNamesResetColumns;
  }
): Promise<MealNamesResetApplyResult> => {
  const serverToday = serverUtcTodayString();
  if (options?.hint && !isMealNamesResetDue(options.hint, serverToday)) {
    return mealNamesResetNoop();
  }

  if (options?.transaction) {
    return applyMealNamesResetLocked(
      familyGroupId,
      options.transaction,
      options.lockedSubscription
    );
  }

  const peek = await Subscription.findOne({
    where: { family_group_id: familyGroupId },
  });
  if (!isMealNamesResetDue(peek?.dataValues, serverToday)) {
    return mealNamesResetNoop();
  }

  const result = await sequelize.transaction((transaction) =>
    applyMealNamesResetLocked(familyGroupId, transaction)
  );
  if (result.applied || result.cleared) {
    emitMealSlotsUpdated(familyGroupId);
  }
  return result;
};

export const familyMealSlotsDifferFromDefaults = async (
  familyGroupId: number
): Promise<boolean> => {
  const slots = await getActiveMealSlots(familyGroupId);
  return !slotsMatchDefaults(slots);
};

/**
 * When a sync leaves the family premium, drop a pending or already-applied
 * meal-name reset. Slots and diary entries stay as they are.
 * Families with neither column set keep the caller's single update.
 */
export const updateSubscriptionClearingMealNamesResetWhenPremium = async (
  subscription: Subscription,
  updates: Partial<SubscriptionAttributes>
): Promise<void> => {
  const current = subscription.dataValues;
  const resulting = { ...current, ...updates };
  const hasResetMarker =
    dateOnlyString(current.meal_names_reset_effective_on) != null ||
    current.meal_names_reset_applied_at != null;

  if (!hasResetMarker || !isPremiumSubscriptionState(resulting)) {
    await subscription.update(updates);
    return;
  }

  await sequelize.transaction(async (transaction) => {
    const locked = await Subscription.findOne({
      where: { id: current.id },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    const target = locked ?? subscription;
    const lockedResulting = { ...target.dataValues, ...updates };
    const clear = isPremiumSubscriptionState(lockedResulting);
    const nextUpdates: Partial<SubscriptionAttributes> = clear
      ? {
          ...updates,
          meal_names_reset_effective_on: null,
          meal_names_reset_applied_at: null,
        }
      : updates;
    await target.update(nextUpdates, { transaction });
    if (target !== subscription) {
      Object.assign(subscription.dataValues, nextUpdates);
    }
  });
};

/**
 * Owner-only. Schedules Breakfast, Lunch, and Dinner from the day after client today.
 * A reset that is already due is applied in the same transaction first.
 */
export const scheduleMealNamesReset = async (
  familyGroupId: number,
  requestingUserId: number,
  todayStr: string
): Promise<ScheduleMealNamesResetResult> => {
  const clientToday = assertTodayWithinSkew(todayStr);
  const effectiveOn = addUtcDays(clientToday, 1);

  const outcome = await sequelize.transaction(async (transaction) => {
    const familyGroup = await FamilyGroup.findByPk(familyGroupId, { transaction });
    if (!familyGroup || familyGroup.dataValues.created_by !== requestingUserId) {
      throw new MealNamesResetForbiddenError();
    }

    const [subscriptionRow] = await Subscription.findOrCreate({
      where: { family_group_id: familyGroupId },
      defaults: { family_group_id: familyGroupId },
      transaction,
    });
    const locked = await Subscription.findOne({
      where: { id: subscriptionRow.dataValues.id },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (!locked) {
      throw new Error('Subscription not found');
    }

    const applyResult = await applyMealNamesResetIfDue(familyGroupId, {
      transaction,
      lockedSubscription: locked,
    });
    const serverToday = serverUtcTodayString();
    if (isPendingMealNamesReset(locked.dataValues, serverToday)) {
      return {
        scheduled: false,
        applied: applyResult.applied,
        cleared: applyResult.cleared,
      };
    }

    const activeSlots =
      locked.dataValues.is_complimentary || locked.dataValues.status !== 'expired'
        ? []
        : await getActiveMealSlots(familyGroupId, transaction);
    const refusalMessage = locked.dataValues.is_complimentary
      ? MEAL_NAMES_RESET_COMPLIMENTARY_MESSAGE
      : locked.dataValues.status !== 'expired'
        ? MEAL_NAMES_RESET_STATUS_MESSAGE
        : slotsMatchDefaults(activeSlots)
          ? MEAL_NAMES_RESET_ALREADY_DEFAULT_MESSAGE
          : null;

    if (refusalMessage) {
      if (applyResult.applied || applyResult.cleared) {
        return {
          scheduled: false,
          applied: applyResult.applied,
          cleared: applyResult.cleared,
        };
      }
      throw new MealSlotsValidationError(refusalMessage);
    }

    await locked.update(
      {
        meal_names_reset_effective_on: effectiveOn,
        meal_names_reset_applied_at: null,
      },
      { transaction }
    );
    await freezeMealNameSnapshots(familyGroupId, effectiveOn, transaction);

    return {
      scheduled: true,
      applied: applyResult.applied,
      cleared: applyResult.cleared,
    };
  });

  if (outcome.scheduled || outcome.applied || outcome.cleared) {
    emitMealSlotsUpdated(familyGroupId);
  }

  return outcome;
};

/**
 * Build per-day slot DTOs for a week response.
 */
export const buildDaySlotsForWeek = async (
  familyGroupId: number,
  weekStartDate: Date,
  dailyMealRows: Array<{
    id: number;
    day_of_week: number;
  }>,
  today: Date = parseDateOnly(formatDateOnly(new Date()))
): Promise<Map<number, DayMealSlotDto[]>> => {
  await applyMealNamesResetIfDue(familyGroupId);

  const serverToday = serverUtcTodayString();
  const subscription = await Subscription.findOne({
    where: { family_group_id: familyGroupId },
  });
  const effectiveOn = dateOnlyString(subscription?.dataValues.meal_names_reset_effective_on);
  const pendingReset =
    effectiveOn != null &&
    subscription?.dataValues.meal_names_reset_applied_at == null &&
    serverToday < effectiveOn;

  const activeSlots = await getActiveMealSlots(familyGroupId);

  const dailyMealIds = dailyMealRows.map((r) => r.id);
  const entries =
    dailyMealIds.length === 0
      ? []
      : await DailyMealEntry.findAll({
          where: { daily_meal_id: { [Op.in]: dailyMealIds } },
          order: [
            ['position', 'ASC'],
            ['id', 'ASC'],
          ],
        });

  const entriesByDailyMeal = new Map<number, DailyMealEntry[]>();
  for (const entry of entries) {
    const list = entriesByDailyMeal.get(entry.dataValues.daily_meal_id) ?? [];
    list.push(entry);
    entriesByDailyMeal.set(entry.dataValues.daily_meal_id, list);
  }

  // Also load legacy_key for archived slots referenced by past entries
  const allSlotIds = new Set<number>();
  for (const entry of entries) {
    allSlotIds.add(entry.dataValues.meal_slot_id);
  }
  for (const slot of activeSlots) {
    allSlotIds.add(slot.id);
  }
  const slotModels =
    allSlotIds.size === 0
      ? []
      : await MealSlot.findAll({
          where: { id: { [Op.in]: [...allSlotIds] } },
        });
  const slotMeta = new Map(
    slotModels.map((s) => [
      s.dataValues.id,
      {
        legacy_key: (s.dataValues.legacy_key as LegacyMealKey | null) ?? null,
      },
    ])
  );

  const weekStartStr = formatDateOnly(
    typeof weekStartDate === 'string'
      ? parseDateOnly(String(weekStartDate).slice(0, 10))
      : new Date(
          Date.UTC(
            weekStartDate.getFullYear(),
            weekStartDate.getMonth(),
            weekStartDate.getDate()
          )
        )
  );

  const keeperSlots = new Map<LegacyMealKey, MealSlot>();
  if (pendingReset) {
    const familySlots = await MealSlot.findAll({
      where: { family_group_id: familyGroupId },
    });
    for (const slot of familySlots) {
      const legacyKey = slot.dataValues.legacy_key as LegacyMealKey | null;
      if (!legacyKey) continue;
      keeperSlots.set(legacyKey, preferKeeperSlot(keeperSlots.get(legacyKey), slot));
    }
  }

  const result = new Map<number, DayMealSlotDto[]>();

  for (const row of dailyMealRows) {
    const date = calendarDateForDiaryDay(weekStartStr, row.day_of_week);
    const dayEntries = entriesByDailyMeal.get(row.id) ?? [];

    if (pendingReset && effectiveOn && formatDateOnly(date) >= effectiveOn) {
      const entryBySlot = new Map(
        dayEntries.map((entry) => [entry.dataValues.meal_slot_id, entry])
      );
      result.set(
        row.day_of_week,
        DEFAULT_LEGACY_MEAL_KEYS.map((legacyKey, index) => {
          const slot = keeperSlots.get(legacyKey);
          const entry = slot ? entryBySlot.get(slot.dataValues.id) : undefined;
          return {
            id: entry?.dataValues.id ?? 0,
            meal_slot_id: slot?.dataValues.id ?? 0,
            name: DEFAULT_MEAL_SLOT_NAMES[index],
            position: index + 1,
            dish: entry?.dataValues.dish ?? null,
            recipe_id: entry?.dataValues.recipe_id ?? null,
            legacy_key: legacyKey,
          };
        })
      );
      continue;
    }

    if (!isDateOnOrAfter(date, today)) {
      // Past day: snapshotted entries
      result.set(
        row.day_of_week,
        dayEntries.map((entry) => ({
          id: entry.dataValues.id,
          meal_slot_id: entry.dataValues.meal_slot_id,
          name: entry.dataValues.name,
          position: entry.dataValues.position,
          dish: entry.dataValues.dish ?? null,
          recipe_id: entry.dataValues.recipe_id ?? null,
          legacy_key: slotMeta.get(entry.dataValues.meal_slot_id)?.legacy_key ?? null,
        }))
      );
      continue;
    }

    // Today+: active template with dishes attached by slot id
    const entryBySlot = new Map(
      dayEntries.map((e) => [e.dataValues.meal_slot_id, e])
    );
    result.set(
      row.day_of_week,
      activeSlots.map((slot) => {
        const entry = entryBySlot.get(slot.id);
        return {
          id: entry?.dataValues.id ?? 0,
          meal_slot_id: slot.id,
          name: slot.name,
          position: slot.position,
          dish: entry?.dataValues.dish ?? null,
          recipe_id: entry?.dataValues.recipe_id ?? null,
          legacy_key: slot.legacy_key,
        };
      })
    );
  }

  return result;
};

/**
 * Apply slot-based dish updates for a day (new clients). Also dual-writes legacy columns.
 */
export const applySlotDishUpdates = async (
  familyGroupId: number,
  dailyMealId: number,
  slotUpdates: Array<{
    meal_slot_id: number;
    dish?: string | null;
    recipe_id?: number | null;
  }>,
  transaction?: Transaction
): Promise<void> => {
  await assertRecipesBelongToFamily(
    familyGroupId,
    slotUpdates.map((update) => update.recipe_id)
  );

  const activeSlots = await getActiveMealSlots(familyGroupId, transaction);
  const activeById = new Map(activeSlots.map((s) => [s.id, s]));

  const legacyPatch: Record<string, unknown> = {};

  for (const update of slotUpdates) {
    const slot = activeById.get(update.meal_slot_id);
    if (!slot) continue;

    const [entry] = await DailyMealEntry.findOrCreate({
      where: {
        daily_meal_id: dailyMealId,
        meal_slot_id: slot.id,
      },
      defaults: {
        daily_meal_id: dailyMealId,
        meal_slot_id: slot.id,
        name: slot.name,
        position: slot.position,
        dish: update.dish === undefined ? null : update.dish || null,
        recipe_id: update.recipe_id === undefined ? null : update.recipe_id,
      },
      transaction,
    });

    const patch: Record<string, unknown> = {
      name: slot.name,
      position: slot.position,
    };
    if (update.dish !== undefined) {
      patch.dish = update.dish || null;
    }
    if (update.recipe_id !== undefined) {
      patch.recipe_id = update.recipe_id;
    }
    await entry.update(patch, { transaction });

    if (slot.legacy_key) {
      if (update.dish !== undefined) {
        legacyPatch[slot.legacy_key] = update.dish || '';
      }
      if (update.recipe_id !== undefined) {
        legacyPatch[`${slot.legacy_key}_recipe_id`] = update.recipe_id;
      }
    }
  }

  if (Object.keys(legacyPatch).length > 0) {
    await DailyMeal.update(legacyPatch as any, {
      where: { id: dailyMealId },
      transaction,
    });
  }
};
