import AsyncStorage from '@react-native-async-storage/async-storage';
import { mealDiarySlotValuesMatch, normalizeMealDiaryDish } from '@meal-diary/shared';
import type { MealDiarySlotValue } from '@meal-diary/shared';

import { normalizeMealDiaryWeekKey } from '@/lib/diary/mealDiaryWeekKey';

const QUEUE_PREFIX = 'meal-diary-pending';

export interface MealDiaryPendingSlot {
  week_start_date: string;
  day_of_week: number;
  meal_slot_id: number;
  baseline: MealDiarySlotValue;
  dish: string | null;
  recipe_id: number | null;
}

const memoryQueues = new Map<number, MealDiaryPendingSlot[]>();
const listeners = new Set<() => void>();
let snapshotVersion = 0;

function buildQueueKey(familyGroupId: number): string {
  return `${QUEUE_PREFIX}:${familyGroupId}`;
}

function notifyListeners(): void {
  snapshotVersion += 1;
  for (const listener of listeners) {
    listener();
  }
}

function slotIdentity(slot: { day_of_week: number; meal_slot_id: number }): string {
  return `${slot.day_of_week}:${slot.meal_slot_id}`;
}

function toSlotValue(dish: string | null, recipeId: number | null): MealDiarySlotValue {
  return {
    dish: normalizeMealDiaryDish(dish),
    recipe_id: recipeId ?? null,
  };
}

function normalizePendingSlot(value: unknown): MealDiaryPendingSlot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const slot = value as Partial<MealDiaryPendingSlot>;
  const weekKey =
    typeof slot.week_start_date === 'string'
      ? normalizeMealDiaryWeekKey(slot.week_start_date)
      : '';
  if (
    !weekKey ||
    typeof slot.day_of_week !== 'number' ||
    typeof slot.meal_slot_id !== 'number' ||
    !slot.baseline ||
    typeof slot.baseline !== 'object'
  ) {
    return null;
  }

  const baseline = toSlotValue(
    slot.baseline.dish ?? null,
    slot.baseline.recipe_id ?? null
  );

  return {
    week_start_date: weekKey,
    day_of_week: slot.day_of_week,
    meal_slot_id: slot.meal_slot_id,
    baseline,
    dish: normalizeMealDiaryDish(slot.dish),
    recipe_id: slot.recipe_id ?? null,
  };
}

export function subscribeMealDiaryPending(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMealDiaryPendingSnapshotVersion(): number {
  return snapshotVersion;
}

export function getMealDiaryPendingSlots(familyGroupId: number): MealDiaryPendingSlot[] {
  return memoryQueues.get(familyGroupId) ?? [];
}

export function getMealDiaryPendingCount(familyGroupId: number): number {
  return getMealDiaryPendingSlots(familyGroupId).length;
}

export async function loadMealDiaryPendingQueue(
  familyGroupId: number
): Promise<MealDiaryPendingSlot[]> {
  try {
    const raw = await AsyncStorage.getItem(buildQueueKey(familyGroupId));
    if (!raw) {
      memoryQueues.set(familyGroupId, []);
      notifyListeners();
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      await AsyncStorage.removeItem(buildQueueKey(familyGroupId));
      memoryQueues.set(familyGroupId, []);
      notifyListeners();
      return [];
    }

    const slots = parsed
      .map((entry) => normalizePendingSlot(entry))
      .filter((entry): entry is MealDiaryPendingSlot => entry != null);
    memoryQueues.set(familyGroupId, slots);
    notifyListeners();

    if (slots.length !== parsed.length) {
      await persistQueue(familyGroupId, slots);
    }

    return slots;
  } catch (error) {
    console.warn('[mealDiaryPendingQueue] Failed to load queue', error);
    memoryQueues.set(familyGroupId, []);
    notifyListeners();
    return [];
  }
}

export async function ensureMealDiaryPendingQueue(
  familyGroupId: number
): Promise<MealDiaryPendingSlot[]> {
  if (memoryQueues.has(familyGroupId)) {
    return memoryQueues.get(familyGroupId) ?? [];
  }
  return loadMealDiaryPendingQueue(familyGroupId);
}

async function persistQueue(
  familyGroupId: number,
  slots: MealDiaryPendingSlot[]
): Promise<void> {
  memoryQueues.set(familyGroupId, slots);
  notifyListeners();

  try {
    if (slots.length === 0) {
      await AsyncStorage.removeItem(buildQueueKey(familyGroupId));
      return;
    }
    await AsyncStorage.setItem(buildQueueKey(familyGroupId), JSON.stringify(slots));
  } catch (error) {
    console.warn('[mealDiaryPendingQueue] Failed to save queue', error);
  }
}

export async function replaceMealDiaryPendingQueue(
  familyGroupId: number,
  slots: MealDiaryPendingSlot[]
): Promise<void> {
  await persistQueue(familyGroupId, slots);
}

/**
 * A later edit of the same slot replaces the dish and recipe and keeps the
 * original baseline. Matching that baseline removes the pending slot.
 */
export async function recordMealDiaryPendingEdit(
  familyGroupId: number,
  edit: MealDiaryPendingSlot
): Promise<MealDiaryPendingSlot | null> {
  const weekKey = normalizeMealDiaryWeekKey(edit.week_start_date);
  if (!weekKey) {
    return null;
  }

  const current = await ensureMealDiaryPendingQueue(familyGroupId);
  const identity = slotIdentity(edit);
  const existing = current.find(
    (slot) => slot.week_start_date === weekKey && slotIdentity(slot) === identity
  );
  const baseline = existing
    ? existing.baseline
    : toSlotValue(edit.baseline.dish, edit.baseline.recipe_id);
  const nextSlot: MealDiaryPendingSlot = {
    week_start_date: weekKey,
    day_of_week: edit.day_of_week,
    meal_slot_id: edit.meal_slot_id,
    baseline,
    dish: normalizeMealDiaryDish(edit.dish),
    recipe_id: edit.recipe_id ?? null,
  };

  if (mealDiarySlotValuesMatch(nextSlot, baseline)) {
    if (!existing) {
      return null;
    }
    await persistQueue(
      familyGroupId,
      current.filter(
        (slot) => !(slot.week_start_date === weekKey && slotIdentity(slot) === identity)
      )
    );
    return null;
  }

  const next = existing
    ? current.map((slot) =>
        slot.week_start_date === weekKey && slotIdentity(slot) === identity ? nextSlot : slot
      )
    : [...current, nextSlot];
  await persistQueue(familyGroupId, next);
  return nextSlot;
}

export async function mealDiaryWeekHasPending(
  familyGroupId: number,
  weekKey: string
): Promise<boolean> {
  const normalized = normalizeMealDiaryWeekKey(weekKey);
  if (!normalized) {
    return false;
  }
  const slots = await ensureMealDiaryPendingQueue(familyGroupId);
  return slots.some((slot) => slot.week_start_date === normalized);
}

export async function removeMealDiaryPendingSlots(
  familyGroupId: number,
  slotsToRemove: Array<{ week_start_date: string; day_of_week: number; meal_slot_id: number }>
): Promise<MealDiaryPendingSlot[]> {
  const current = await ensureMealDiaryPendingQueue(familyGroupId);
  const removeKeys = new Set(
    slotsToRemove.map(
      (slot) =>
        `${normalizeMealDiaryWeekKey(slot.week_start_date)}:${slotIdentity(slot)}`
    )
  );
  const next = current.filter(
    (slot) => !removeKeys.has(`${slot.week_start_date}:${slotIdentity(slot)}`)
  );
  if (next.length !== current.length) {
    await persistQueue(familyGroupId, next);
  }
  return next;
}

export async function dropMealDiaryPendingQueue(familyGroupId: number): Promise<void> {
  memoryQueues.delete(familyGroupId);
  notifyListeners();
  try {
    await AsyncStorage.removeItem(buildQueueKey(familyGroupId));
  } catch (error) {
    console.warn('[mealDiaryPendingQueue] Failed to drop queue', error);
  }
}

export async function dropMealDiaryQueuesExcept(
  familyGroupId: number | null
): Promise<void> {
  const keepKey = familyGroupId == null ? null : buildQueueKey(familyGroupId);
  for (const id of [...memoryQueues.keys()]) {
    if (id !== familyGroupId) {
      memoryQueues.delete(id);
    }
  }
  notifyListeners();

  try {
    const keys = await AsyncStorage.getAllKeys();
    const queueKeys = keys.filter(
      (key) => key.startsWith(`${QUEUE_PREFIX}:`) && key !== keepKey
    );
    if (queueKeys.length > 0) {
      await AsyncStorage.multiRemove(queueKeys);
    }
  } catch (error) {
    console.warn('[mealDiaryPendingQueue] Failed to drop other queues', error);
  }
}

export async function clearAllMealDiaryPendingQueues(): Promise<void> {
  memoryQueues.clear();
  notifyListeners();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const queueKeys = keys.filter((key) => key.startsWith(`${QUEUE_PREFIX}:`));
    if (queueKeys.length > 0) {
      await AsyncStorage.multiRemove(queueKeys);
    }
  } catch (error) {
    console.warn('[mealDiaryPendingQueue] Failed to clear queues', error);
  }
}
