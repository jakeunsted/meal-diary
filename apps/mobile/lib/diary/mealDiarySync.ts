import type { QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import {
  mealDiarySlotValuesMatch,
  type MealDiaryResolveRequest,
  type MealDiarySyncRequest,
  type MealDiarySyncResult,
  type MealDiarySlotValue,
} from '@meal-diary/shared';

import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { isNetworkError } from '@/lib/auth/httpError';
import { saveWeeklyMealsCache } from '@/lib/diary/mealDiaryStorage';
import {
  ensureMealDiaryPendingQueue,
  getMealDiaryPendingSlots,
  removeMealDiaryPendingSlots,
  replaceMealDiaryPendingQueue,
  type MealDiaryPendingSlot,
} from '@/lib/diary/mealDiaryPendingQueue';
import {
  overlayPendingSlots,
  restoreSkippedSlots,
} from '@/lib/diary/mealDiarySlotState';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { mealDiaryKeys } from '@/lib/queries/mealDiary';
import type { DailyMeal } from '@/types/mealDiary';

export interface MealDiarySyncResponse {
  dailyMeals: DailyMeal[];
  results: MealDiarySyncResult[];
}

export interface MealDiaryConflictRow {
  dayOfWeek: number;
  mealSlotId: number;
  yours: MealDiarySlotValue;
  theirs: MealDiarySlotValue;
  baseline: MealDiarySlotValue;
}

export interface MealDiaryReview {
  familyGroupId: number;
  weekStartDate: string;
  rows: MealDiaryConflictRow[];
  serverMeals: DailyMeal[];
  isResolving: boolean;
}

export interface MealDiarySyncStatus {
  isFlushing: boolean;
  isOnline: boolean;
  syncError: boolean;
  pendingCount: number;
}

interface FlushOptions {
  presentReview?: boolean;
  openPaywall?: boolean;
}

type SyncListener = () => void;

const flushLocks = new Set<number>();
const flushAgain = new Set<number>();
const statusByFamily = new Map<number, MealDiarySyncStatus>();
const listeners = new Set<SyncListener>();
const reviewQueue: MealDiaryReview[] = [];
let syncVersion = 0;
let reviewGeneration = 0;
let isResolving = false;
/** Undefined until the signed-in family is known. Null means signed out. */
let activeFamilyId: number | null | undefined;

function notifyListeners(): void {
  syncVersion += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeMealDiarySync(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMealDiarySyncVersion(): number {
  return syncVersion;
}

function defaultStatus(): MealDiarySyncStatus {
  return {
    isFlushing: false,
    isOnline: true,
    syncError: false,
    pendingCount: 0,
  };
}

export function getMealDiarySyncStatus(familyGroupId: number): MealDiarySyncStatus {
  return statusByFamily.get(familyGroupId) ?? defaultStatus();
}

function patchStatus(familyGroupId: number, patch: Partial<MealDiarySyncStatus>): void {
  const current = getMealDiarySyncStatus(familyGroupId);
  statusByFamily.set(familyGroupId, { ...current, ...patch });
  notifyListeners();
}

export function setMealDiaryOnlineStatus(familyGroupId: number, isOnline: boolean): void {
  patchStatus(familyGroupId, { isOnline });
}

export function isMealDiaryNetworkOnline(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  if (state.isConnected === false) {
    return false;
  }
  if (state.isInternetReachable === false) {
    return false;
  }
  return true;
}

async function readDeviceOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return isMealDiaryNetworkOnline(state);
  } catch {
    return true;
  }
}

export function getOpenMealDiaryReview(): MealDiaryReview | null {
  const review = reviewQueue[0];
  if (!review) {
    return null;
  }
  return { ...review, isResolving };
}

function isActiveFamily(familyGroupId: number): boolean {
  if (activeFamilyId === undefined) {
    return true;
  }
  return activeFamilyId === familyGroupId;
}

export function setMealDiarySyncFamily(familyGroupId: number | null): void {
  activeFamilyId = familyGroupId;
  const remaining = reviewQueue.filter((review) => review.familyGroupId === familyGroupId);
  if (remaining.length === reviewQueue.length) {
    return;
  }
  reviewGeneration += 1;
  reviewQueue.length = 0;
  reviewQueue.push(...remaining);
  isResolving = false;
  notifyListeners();
}

export function resetMealDiarySyncState(): void {
  flushLocks.clear();
  flushAgain.clear();
  statusByFamily.clear();
  reviewQueue.length = 0;
  reviewGeneration += 1;
  isResolving = false;
  notifyListeners();
}

function withWeekKey(meals: DailyMeal[], weekKey: string): DailyMeal[] {
  return meals.map((meal) => ({
    ...meal,
    week_start_date: weekKey,
  }));
}

function writeWeek(
  queryClient: QueryClient,
  familyGroupId: number,
  weekKey: string,
  meals: DailyMeal[]
): void {
  queryClient.setQueryData(mealDiaryKeys.weekly(familyGroupId, weekKey), meals);
  void saveWeeklyMealsCache(familyGroupId, weekKey, meals);
}

function slotValue(slot: { dish: string | null; recipe_id: number | null }): MealDiarySlotValue {
  return {
    dish: slot.dish,
    recipe_id: slot.recipe_id,
  };
}

function samePendingSlot(
  slot: MealDiaryPendingSlot,
  weekKey: string,
  dayOfWeek: number,
  mealSlotId: number
): boolean {
  return (
    slot.week_start_date === weekKey &&
    slot.day_of_week === dayOfWeek &&
    slot.meal_slot_id === mealSlotId
  );
}

function stillMatchesSubmission(
  current: MealDiaryPendingSlot,
  submitted: MealDiaryPendingSlot
): boolean {
  return (
    mealDiarySlotValuesMatch(slotValue(current), slotValue(submitted)) &&
    mealDiarySlotValuesMatch(current.baseline, submitted.baseline)
  );
}

function diaryEntitlementFeature(
  error: unknown
): 'edit_past_weeks' | 'weeks_ahead' | null {
  if (!(error instanceof ApiError)) {
    return null;
  }
  if (error.status !== 403 || error.code !== 'ENTITLEMENT_REQUIRED') {
    return null;
  }
  if (error.feature === 'edit_past_weeks' || error.feature === 'weeks_ahead') {
    return error.feature;
  }
  return null;
}

function reviewWeeks(): Set<string> {
  return new Set(reviewQueue.map((review) => review.weekStartDate));
}

function replaceOpenReview(next: MealDiaryReview | null): void {
  if (!reviewQueue.length) {
    if (next) {
      reviewQueue.push(next);
    }
    notifyListeners();
    return;
  }
  if (!next) {
    reviewQueue.shift();
  } else {
    reviewQueue[0] = next;
  }
  notifyListeners();
}

interface SettledWeek {
  pending: MealDiaryPendingSlot[];
  conflicts: MealDiaryConflictRow[];
}

function settleWeekResults(
  pending: MealDiaryPendingSlot[],
  weekKey: string,
  submitted: MealDiaryPendingSlot[],
  results: MealDiarySyncResult[]
): SettledWeek {
  let next = [...pending];
  const conflicts: MealDiaryConflictRow[] = [];

  for (const result of results) {
    const submittedSlot = submitted.find(
      (slot) =>
        slot.day_of_week === result.day_of_week && slot.meal_slot_id === result.meal_slot_id
    );
    const current = next.find((slot) =>
      samePendingSlot(slot, weekKey, result.day_of_week, result.meal_slot_id)
    );
    if (!current) {
      continue;
    }

    if (result.status === 'slot_removed') {
      next = next.filter(
        (slot) => !samePendingSlot(slot, weekKey, result.day_of_week, result.meal_slot_id)
      );
      continue;
    }

    if (!submittedSlot || !stillMatchesSubmission(current, submittedSlot)) {
      continue;
    }

    if (result.status === 'recipe_rejected') {
      next = next.filter(
        (slot) => !samePendingSlot(slot, weekKey, result.day_of_week, result.meal_slot_id)
      );
      continue;
    }

    if (result.status === 'applied' || result.status === 'already_saved') {
      next = next.filter(
        (slot) => !samePendingSlot(slot, weekKey, result.day_of_week, result.meal_slot_id)
      );
      continue;
    }

    if (
      result.status === 'conflict' &&
      result.yours &&
      result.theirs &&
      result.baseline
    ) {
      const yours = result.yours;
      const theirs = result.theirs;
      const baseline = result.baseline;
      next = next.map((slot) =>
        samePendingSlot(slot, weekKey, result.day_of_week, result.meal_slot_id)
          ? {
              ...slot,
              dish: yours.dish,
              recipe_id: yours.recipe_id,
              baseline,
            }
          : slot
      );
      conflicts.push({
        dayOfWeek: result.day_of_week,
        mealSlotId: result.meal_slot_id,
        yours,
        theirs,
        baseline,
      });
    }
  }

  return { pending: next, conflicts };
}

async function publishWeek(
  queryClient: QueryClient,
  familyGroupId: number,
  weekKey: string,
  serverMeals: DailyMeal[],
  pending: MealDiaryPendingSlot[]
): Promise<void> {
  const displayed = overlayPendingSlots(serverMeals, weekKey, pending);
  writeWeek(queryClient, familyGroupId, weekKey, displayed);
}

export async function flushMealDiaryPending(
  queryClient: QueryClient,
  familyGroupId: number,
  options: FlushOptions = {}
): Promise<void> {
  const presentReview = options.presentReview !== false;
  const openPaywall = options.openPaywall !== false;

  if (flushLocks.has(familyGroupId)) {
    flushAgain.add(familyGroupId);
    return;
  }

  flushLocks.add(familyGroupId);
  patchStatus(familyGroupId, { isFlushing: true, syncError: false });

  try {
    do {
      flushAgain.delete(familyGroupId);
      const stopped = await flushUnlocked(queryClient, familyGroupId, {
        presentReview,
        openPaywall,
      });
      if (stopped) {
        break;
      }
    } while (flushAgain.has(familyGroupId));
  } finally {
    flushLocks.delete(familyGroupId);
    patchStatus(familyGroupId, { isFlushing: false });
  }
}

async function flushUnlocked(
  queryClient: QueryClient,
  familyGroupId: number,
  options: Required<FlushOptions>
): Promise<boolean> {
  const online = await readDeviceOnline();
  patchStatus(familyGroupId, { isOnline: online });
  if (!online) {
    return true;
  }

  const pending = await ensureMealDiaryPendingQueue(familyGroupId);
  const blockedWeeks = reviewWeeks();
  const weeks = [
    ...new Set(
      pending
        .map((slot) => slot.week_start_date)
        .filter((weekKey) => !blockedWeeks.has(weekKey))
    ),
  ].sort();

  for (const weekKey of weeks) {
    const submitted = getMealDiaryPendingSlots(familyGroupId).filter(
      (slot) => slot.week_start_date === weekKey
    );
    if (submitted.length === 0) {
      continue;
    }

    const body: MealDiarySyncRequest = {
      week_start_date: weekKey,
      slots: submitted.map((slot) => ({
        day_of_week: slot.day_of_week,
        meal_slot_id: slot.meal_slot_id,
        baseline: slot.baseline,
        dish: slot.dish,
        recipe_id: slot.recipe_id,
      })),
    };

    try {
      const response = await apiFetch<MealDiarySyncResponse>(
        `/meal-diaries/${familyGroupId}/daily-meals/sync`,
        { method: 'POST', body }
      );
      await applyFlushResponse(
        queryClient,
        familyGroupId,
        weekKey,
        submitted,
        response,
        options.presentReview
      );
    } catch (error) {
      const feature = diaryEntitlementFeature(error);
      if (feature) {
        if (options.openPaywall) {
          usePaywallStore.getState().openPaywall(feature);
        }
        continue;
      }
      if (!isNetworkError(error)) {
        console.warn('[mealDiarySync] Failed to sync diary week', error);
      }
      patchStatus(familyGroupId, { syncError: true });
      return true;
    }
  }

  return false;
}

async function applyFlushResponse(
  queryClient: QueryClient,
  familyGroupId: number,
  weekKey: string,
  submitted: MealDiaryPendingSlot[],
  response: MealDiarySyncResponse,
  presentReview: boolean
): Promise<void> {
  if (!isActiveFamily(familyGroupId)) {
    return;
  }

  const current = await ensureMealDiaryPendingQueue(familyGroupId);
  const settled = settleWeekResults(current, weekKey, submitted, response.results ?? []);
  let pending = settled.pending;

  if (settled.conflicts.length > 0 && !presentReview) {
    pending = pending.filter(
      (slot) =>
        !settled.conflicts.some((conflict) =>
          samePendingSlot(slot, weekKey, conflict.dayOfWeek, conflict.mealSlotId)
        )
    );
  }

  await replaceMealDiaryPendingQueue(familyGroupId, pending);
  const serverMeals = withWeekKey(response.dailyMeals ?? [], weekKey);
  await publishWeek(queryClient, familyGroupId, weekKey, serverMeals, pending);

  if (presentReview && settled.conflicts.length > 0) {
    reviewQueue.push({
      familyGroupId,
      weekStartDate: weekKey,
      rows: settled.conflicts,
      serverMeals,
      isResolving: false,
    });
    notifyListeners();
  }
}

async function dropConflictRows(
  queryClient: QueryClient,
  review: MealDiaryReview,
  rows: MealDiaryConflictRow[]
): Promise<void> {
  reviewGeneration += 1;
  const skipped = rows.map((row) => ({
    day_of_week: row.dayOfWeek,
    meal_slot_id: row.mealSlotId,
  }));
  const pending = await removeMealDiaryPendingSlots(
    review.familyGroupId,
    skipped.map((slot) => ({
      ...slot,
      week_start_date: review.weekStartDate,
    }))
  );
  const current = queryClient.getQueryData<DailyMeal[]>(
    mealDiaryKeys.weekly(review.familyGroupId, review.weekStartDate)
  );
  const restored = restoreSkippedSlots(
    current,
    review.serverMeals,
    review.weekStartDate,
    skipped,
    pending
  );
  writeWeek(queryClient, review.familyGroupId, review.weekStartDate, restored);

  const remaining = review.rows.filter(
    (row) =>
      !rows.some(
        (dropped) =>
          dropped.dayOfWeek === row.dayOfWeek && dropped.mealSlotId === row.mealSlotId
      )
  );
  if (remaining.length === 0) {
    replaceOpenReview(null);
    return;
  }
  replaceOpenReview({
    ...review,
    rows: remaining,
    isResolving: false,
  });
}

export async function skipMealDiaryReview(queryClient: QueryClient): Promise<void> {
  const review = reviewQueue[0];
  if (!review) {
    return;
  }
  await dropConflictRows(queryClient, review, review.rows);
}

export async function keepMealDiaryTheirs(
  queryClient: QueryClient,
  dayOfWeek: number,
  mealSlotId: number
): Promise<void> {
  const review = reviewQueue[0];
  if (!review) {
    return;
  }
  const row = review.rows.find(
    (entry) => entry.dayOfWeek === dayOfWeek && entry.mealSlotId === mealSlotId
  );
  if (!row) {
    return;
  }
  await dropConflictRows(queryClient, review, [row]);
}

export async function keepMealDiaryMine(
  queryClient: QueryClient,
  rowsToKeep?: Array<{ dayOfWeek: number; mealSlotId: number }>
): Promise<void> {
  const review = reviewQueue[0];
  if (!review || isResolving) {
    return;
  }

  const rows = rowsToKeep
    ? review.rows.filter((row) =>
        rowsToKeep.some(
          (target) =>
            target.dayOfWeek === row.dayOfWeek && target.mealSlotId === row.mealSlotId
        )
      )
    : review.rows;
  if (rows.length === 0) {
    return;
  }

  const generation = reviewGeneration;
  isResolving = true;
  notifyListeners();

  try {
    const online = await readDeviceOnline();
    patchStatus(review.familyGroupId, { isOnline: online });
    if (!online) {
      patchStatus(review.familyGroupId, { syncError: true });
      return;
    }

    const body: MealDiaryResolveRequest = {
      week_start_date: review.weekStartDate,
      keep_mine: rows.map((row) => ({
        day_of_week: row.dayOfWeek,
        meal_slot_id: row.mealSlotId,
        dish: row.yours.dish,
        recipe_id: row.yours.recipe_id,
        expected: row.theirs,
        baseline: row.baseline,
      })),
    };

    const response = await apiFetch<MealDiarySyncResponse>(
      `/meal-diaries/${review.familyGroupId}/daily-meals/sync/resolve`,
      { method: 'POST', body }
    );

    if (generation !== reviewGeneration) {
      if (isActiveFamily(review.familyGroupId)) {
        await keepAppliedAfterSkip(queryClient, review, response);
      }
      return;
    }

    await applyResolveResponse(queryClient, review, rows, response);
  } catch (error) {
    if (generation !== reviewGeneration) {
      return;
    }
    const feature = diaryEntitlementFeature(error);
    if (feature) {
      usePaywallStore.getState().openPaywall(feature);
      return;
    }
    if (!isNetworkError(error)) {
      console.warn('[mealDiarySync] Failed to resolve diary conflicts', error);
    }
    patchStatus(review.familyGroupId, { syncError: true });
  } finally {
    isResolving = false;
    notifyListeners();
  }
}

async function keepAppliedAfterSkip(
  queryClient: QueryClient,
  review: MealDiaryReview,
  response: MealDiarySyncResponse
): Promise<void> {
  const applied = (response.results ?? []).filter(
    (result) => result.status === 'applied' || result.status === 'already_saved'
  );
  if (applied.length === 0) {
    return;
  }
  const pending = getMealDiaryPendingSlots(review.familyGroupId);
  const current = queryClient.getQueryData<DailyMeal[]>(
    mealDiaryKeys.weekly(review.familyGroupId, review.weekStartDate)
  );
  const restored = restoreSkippedSlots(
    current,
    withWeekKey(response.dailyMeals ?? [], review.weekStartDate),
    review.weekStartDate,
    applied.map((result) => ({
      day_of_week: result.day_of_week,
      meal_slot_id: result.meal_slot_id,
    })),
    pending
  );
  writeWeek(queryClient, review.familyGroupId, review.weekStartDate, restored);
}

async function applyResolveResponse(
  queryClient: QueryClient,
  review: MealDiaryReview,
  sentRows: MealDiaryConflictRow[],
  response: MealDiarySyncResponse
): Promise<void> {
  if (!isActiveFamily(review.familyGroupId)) {
    return;
  }

  const weekKey = review.weekStartDate;
  const serverMeals = withWeekKey(response.dailyMeals ?? [], weekKey);
  let pending = await ensureMealDiaryPendingQueue(review.familyGroupId);
  let rows = review.rows;

  for (const result of response.results ?? []) {
    const sent = sentRows.find(
      (row) => row.dayOfWeek === result.day_of_week && row.mealSlotId === result.meal_slot_id
    );
    if (!sent) {
      continue;
    }

    if (
      result.status === 'conflict' &&
      result.yours &&
      result.theirs &&
      result.baseline
    ) {
      const yours = result.yours;
      const theirs = result.theirs;
      const baseline = result.baseline;
      rows = rows.map((row) =>
        row.dayOfWeek === result.day_of_week && row.mealSlotId === result.meal_slot_id
          ? { ...row, yours, theirs, baseline }
          : row
      );
      pending = pending.map((slot) =>
        samePendingSlot(slot, weekKey, result.day_of_week, result.meal_slot_id)
          ? {
              ...slot,
              dish: yours.dish,
              recipe_id: yours.recipe_id,
              baseline,
            }
          : slot
      );
      continue;
    }

    rows = rows.filter(
      (row) =>
        !(row.dayOfWeek === result.day_of_week && row.mealSlotId === result.meal_slot_id)
    );
    pending = pending.filter(
      (slot) => !samePendingSlot(slot, weekKey, result.day_of_week, result.meal_slot_id)
    );
  }

  await replaceMealDiaryPendingQueue(review.familyGroupId, pending);
  await publishWeek(queryClient, review.familyGroupId, weekKey, serverMeals, pending);

  const open = reviewQueue[0];
  if (!open || open.weekStartDate !== weekKey || open.familyGroupId !== review.familyGroupId) {
    return;
  }
  if (rows.length === 0) {
    replaceOpenReview(null);
    return;
  }
  replaceOpenReview({
    ...open,
    rows,
    serverMeals,
    isResolving: false,
  });
}

export async function retryMealDiarySync(
  queryClient: QueryClient,
  familyGroupId: number
): Promise<void> {
  patchStatus(familyGroupId, { syncError: false });
  await flushMealDiaryPending(queryClient, familyGroupId);
}
