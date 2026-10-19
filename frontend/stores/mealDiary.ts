import { defineStore } from 'pinia';
import { startOfISOWeek } from 'date-fns';
import { useUserStore } from './user';
import { Preferences } from '@capacitor/preferences';
import type {
  MealDiaryState,
  DailyMeal,
  MealDiaryPendingSlot,
  MealDiarySyncConflict,
  MealDiarySyncEntitlement,
} from '~/types/MealDiary';
import { useApi } from '~/composables/useApi';
import {
  normalizeMealDiaryWeekKey,
  weekKeysEqual,
  weeklyMealsMatchWeek,
} from '~/composables/mealDiaryWeekKey';
import {
  mealDiarySlotValuesMatch,
  normalizeMealDiaryDish,
  type MealDiarySyncResult,
} from '@meal-diary/shared';
import {
  MEAL_DIARY_PENDING_KEY,
  applyLegacyColumnsFromSlots,
  cloneServerWeek,
  isMealDiaryPendingSlot,
  normalizePendingSlot,
  readSlotValue,
  restorePendingLegacyColumns,
  slotValue,
  writeSlotValue,
} from '~/utils/mealDiarySync';
import { extractEntitlementError, extractErrorMessage, getHttpStatusCode, isNetworkError } from '~/utils/httpError';
import { useToast } from '~/composables/useToast';

/** Client-side cache TTL for weekly meals (matches fetch + initialize logic). */
const WEEKLY_MEALS_CACHE_MS = 5 * 60 * 1000;

/** Tracks overlapping fetchWeeklyMeals calls so loading stays true until the last one finishes. */
let weeklyMealsFetchDepth = 0;

/** In-flight fetch per week key — duplicate requests share the same promise. */
const inflightWeeklyMeals = new Map<string, Promise<void>>();

/** Batches rapid Preferences writes (e.g. multiple SSE updates). */
let persistDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DEBOUNCE_MS = 400;

/** Bumped when a local edit or sync write lands, so an older week fetch cannot overwrite it. */
let diaryRevision = 0;
let pendingReady = false;
let pendingLoadPromise: Promise<void> | null = null;
let diarySyncTail: Promise<void> = Promise.resolve();

/** Last sync/resolve week payload, used to restore server dishes after keep-theirs or skip. */
const serverWeeks = new Map<string, DailyMeal[]>();

interface MealDiarySyncResponse {
  dailyMeals?: DailyMeal[];
  results?: MealDiarySyncResult[];
}

const enqueueDiarySync = (task: () => Promise<void>): Promise<void> => {
  const run = diarySyncTail.then(task, task);
  diarySyncTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

const isSaveNetworkFailure = (error: unknown): boolean => {
  if (isNetworkError(error) || getHttpStatusCode(error) === 0) {
    return true;
  }
  if (getHttpStatusCode(error) != null) {
    return false;
  }
  const name = typeof error === 'object' && error && 'name' in error
    ? String((error as { name?: string }).name)
    : '';
  return name === 'TypeError' || name === 'FetchError';
};

const TERMINAL_SYNC_STATUSES = new Set<MealDiarySyncResult['status']>([
  'applied',
  'already_saved',
  'slot_removed',
  'recipe_rejected',
]);

export const useMealDiaryStore = defineStore('mealDiary', {
  state: (): MealDiaryState => ({
    weeklyMeals: [],
    loading: false,
    selectedMeal: {
      type: null,
      mealSlotId: null,
      dayOfWeek: null,
      name: '',
      recipeId: null,
    },
    eventSource: null as EventSource | null,
    currentWeekStart: null as string | null,
    lastFetchTime: null as number | null,
    lastFetchError: null as string | null,
    pendingSlots: [] as MealDiaryPendingSlot[],
    syncFailed: false,
    syncEntitlementByWeek: {} as Record<string, MealDiarySyncEntitlement>,
    conflicts: [] as MealDiarySyncConflict[],
    reviewWeekStart: null as string | null,
    syncing: false,
  }),

  getters: {
    getDayMeals: (state) => (dayOfWeek: number) => {
      return state.weeklyMeals.find(meal => meal.day_of_week === dayOfWeek);
    },

    isWeekReady: (state) => (weekKey: string) => {
      return (
        weekKeysEqual(state.currentWeekStart, weekKey) &&
        weeklyMealsMatchWeek(state.weeklyMeals, weekKey)
      );
    },
  },

  actions: {
    // Current ISO week Monday at local midnight (matches WeekCalendarPicker)
    getWeekStartDate() {
      const monday = startOfISOWeek(new Date());
      monday.setHours(0, 0, 0, 0);
      return monday;
    },

    // Save to Preferences
    async saveToLocalStorage() {
      if (import.meta.client) {
        const dataToStore = {
          weeklyMeals: this.weeklyMeals,
          currentWeekStart: this.currentWeekStart,
          lastFetchTime: this.lastFetchTime
        };
        await Preferences.set({
          key: 'mealDiary',
          value: JSON.stringify(dataToStore)
        });
      }
    },

    /** Coalesce rapid writes (e.g. SSE bursts) before persisting to Preferences. */
    schedulePersistToLocalStorage() {
      if (!import.meta.client) {
        return;
      }
      if (persistDebounceTimer !== null) {
        clearTimeout(persistDebounceTimer);
      }
      persistDebounceTimer = setTimeout(() => {
        persistDebounceTimer = null;
        void this.saveToLocalStorage();
      }, PERSIST_DEBOUNCE_MS);
    },

    // Load from Preferences
    async loadFromLocalStorage() {
      if (import.meta.client) {
        const { value } = await Preferences.get({ key: 'mealDiary' });
        if (value) {
          try {
            const { weeklyMeals, currentWeekStart, lastFetchTime } = JSON.parse(value);
            if (!Array.isArray(weeklyMeals)) {
              await Preferences.remove({ key: 'mealDiary' });
              return false;
            }
            this.currentWeekStart = currentWeekStart
              ? normalizeMealDiaryWeekKey(currentWeekStart)
              : null;
            this.weeklyMeals = weeklyMeals.map((meal: DailyMeal) => ({
              ...meal,
              week_start_date: normalizeMealDiaryWeekKey(
                meal.week_start_date || this.currentWeekStart || new Date()
              ),
            }));
            this.lastFetchTime = lastFetchTime;
            return true;
          } catch (error) {
            console.error('Failed to parse stored meal diary:', error);
            await Preferences.remove({ key: 'mealDiary' });
          }
        }
      }
      return false;
    },

    /** Load cached diary from Preferences only (no network). */
    async hydrateFromStorage() {
      const authStore = useAuthStore();
      if (!authStore.user?.family_group_id) {
        return;
      }
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) {
        return;
      }
      await this.loadFromLocalStorage();
      await this.ensurePendingLoaded();
      const familyId = userStore.user.family_group_id;
      if (familyId) {
        await this.dropUnmatchedPending(familyId);
        this.overlayPendingOntoCurrentWeek();
      }
    },

    /** @deprecated Use hydrateFromStorage — fetch is owned by useMealDiaryWeek on the diary page. */
    async initialize() {
      await this.hydrateFromStorage();
    },

    // Fetch daily meals for week from API
    async fetchWeeklyMeals(weekStartDate?: Date, forceRefresh = false) {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      const dateToUse = weekStartDate || this.getWeekStartDate();
      const weekStartDateStr = normalizeMealDiaryWeekKey(dateToUse);
      if (!weekStartDateStr) {
        return;
      }

      const hasDataForWeek = this.isWeekReady(weekStartDateStr);
      const now = Date.now();
      const cacheAge = this.lastFetchTime ? now - this.lastFetchTime : Infinity;

      if (hasDataForWeek && !forceRefresh && cacheAge <= WEEKLY_MEALS_CACHE_MS) {
        return;
      }

      if (!forceRefresh) {
        const existing = inflightWeeklyMeals.get(weekStartDateStr);
        if (existing) {
          return existing;
        }
      } else {
        inflightWeeklyMeals.delete(weekStartDateStr);
      }

      const fetchPromise = this.executeWeeklyMealsFetch(weekStartDateStr, now);
      inflightWeeklyMeals.set(weekStartDateStr, fetchPromise);

      try {
        await fetchPromise;
      } finally {
        if (inflightWeeklyMeals.get(weekStartDateStr) === fetchPromise) {
          inflightWeeklyMeals.delete(weekStartDateStr);
        }
      }
    },

    async executeWeeklyMealsFetch(weekStartDateStr: string, fetchStartedAt: number) {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      weeklyMealsFetchDepth += 1;
      this.loading = true;
      const revisionAtStart = diaryRevision;

      try {
        const familyGroupId = userStore.user.family_group_id;
        const { api } = useApi();
        const response = await api(
          `/api/meal-diaries/${familyGroupId}/${weekStartDateStr}/daily-meals`
        );

        if (revisionAtStart !== diaryRevision) {
          this.lastFetchError = null;
          return;
        }

        this.weeklyMeals = response.map((meal: DailyMeal) => ({
          ...meal,
          week_start_date: weekStartDateStr,
        }));
        this.currentWeekStart = weekStartDateStr;
        this.lastFetchTime = fetchStartedAt;
        this.lastFetchError = null;
        await this.ensurePendingLoaded();
        this.overlayPendingOntoCurrentWeek();
        await this.saveToLocalStorage();
      } catch (error: unknown) {
        console.error('Error fetching weekly meals:', error);
        const err = error as { statusCode?: number; status?: number; message?: string };
        const loadedFromStorage = await this.loadFromLocalStorage();
        this.lastFetchError = err?.message || 'Failed to load meal diary';
        if (!loadedFromStorage) {
          throw error;
        }
      } finally {
        weeklyMealsFetchDepth -= 1;
        if (weeklyMealsFetchDepth < 0) {
          weeklyMealsFetchDepth = 0;
        }
        this.loading = weeklyMealsFetchDepth > 0;
      }
    },

    // Set selected meal for modal (legacy type and/or meal_slot_id)
    setSelectedMeal(
      type: string,
      dayOfWeek: number,
      mealSlotId: number | null = null
    ) {
      const existingDayMeal = this.weeklyMeals.find(meal => meal.day_of_week === dayOfWeek);

      let existingMealName = '';
      let existingRecipeId: number | null = null;

      if (mealSlotId != null && existingDayMeal?.slots?.length) {
        const slot = existingDayMeal.slots.find((s) => s.meal_slot_id === mealSlotId);
        existingMealName = slot?.dish || '';
        existingRecipeId = slot?.recipe_id ?? null;
      } else if (existingDayMeal && (type === 'breakfast' || type === 'lunch' || type === 'dinner')) {
        existingMealName =
          existingDayMeal[type as keyof Pick<DailyMeal, 'breakfast' | 'lunch' | 'dinner'>] || '';
        const recipeIdKey = `${type}_recipe_id` as keyof Pick<
          DailyMeal,
          'breakfast_recipe_id' | 'lunch_recipe_id' | 'dinner_recipe_id'
        >;
        existingRecipeId = existingDayMeal[recipeIdKey] || null;
      }

      this.selectedMeal = {
        type,
        mealSlotId,
        dayOfWeek,
        name: existingMealName,
        recipeId: existingRecipeId,
      };
    },

    // Update selected meal name
    updateSelectedMealName(name: string) {
      if (this.selectedMeal) {
        this.selectedMeal.name = name;
      }
    },

    // Update selected meal recipe ID
    updateSelectedMealRecipeId(recipeId: number | null) {
      if (this.selectedMeal) {
        this.selectedMeal.recipeId = recipeId;
      }
    },

    resetSelectedMeal() {
      this.selectedMeal = {
        type: null,
        mealSlotId: null,
        dayOfWeek: null,
        name: '',
        recipeId: null,
      };
    },

    browserIsOnline() {
      if (!import.meta.client || typeof navigator === 'undefined') {
        return true;
      }
      return navigator.onLine;
    },

    signedInFamilyId() {
      return useUserStore().user?.family_group_id ?? null;
    },

    // Save meal to API, or queue it when this week is already pending or the network fails.
    async saveMeal() {
      const userStore = useUserStore();
      if (
        !userStore.user?.family_group_id ||
        (!this.selectedMeal.type && this.selectedMeal.mealSlotId == null) ||
        !this.selectedMeal.dayOfWeek
      ) {
        return;
      }

      await this.ensurePendingLoaded();
      const familyId = userStore.user.family_group_id;
      const weekStartDate =
        this.currentWeekStart || normalizeMealDiaryWeekKey(this.getWeekStartDate());
      const mealSlotId = this.selectedMeal.mealSlotId;
      const weekHasPending = this.pendingSlots.some(
        (slot) =>
          slot.family_group_id === familyId &&
          weekKeysEqual(slot.week_start_date, weekStartDate)
      );
      const shouldQueue = mealSlotId != null && (!this.browserIsOnline() || weekHasPending);

      if (shouldQueue) {
        await this.queueSelectedSlot();
        this.resetSelectedMeal();
        if (this.browserIsOnline()) {
          await this.flushPending();
        }
        return;
      }

      try {
        // Get the existing day meals or create empty values
        const dayMeal = this.weeklyMeals.find(meal => meal.day_of_week === this.selectedMeal.dayOfWeek) || {
          breakfast: null,
          lunch: null,
          dinner: null,
          breakfast_recipe_id: null,
          lunch_recipe_id: null,
          dinner_recipe_id: null,
          day_of_week: this.selectedMeal.dayOfWeek,
          slots: [],
        };
        // Create a complete meal object with all meal types
        const mealData: any = {
          week_start_date:
            this.currentWeekStart || normalizeMealDiaryWeekKey(this.getWeekStartDate()),
          day_of_week: this.selectedMeal.dayOfWeek,
          breakfast: dayMeal.breakfast || '',
          lunch: dayMeal.lunch || '',
          dinner: dayMeal.dinner || '',
          breakfast_recipe_id: dayMeal.breakfast_recipe_id || null,
          lunch_recipe_id: dayMeal.lunch_recipe_id || null,
          dinner_recipe_id: dayMeal.dinner_recipe_id || null,
        };

        const mealName = this.selectedMeal.name?.trim() ?? '';
        const mealType = this.selectedMeal.type as 'breakfast' | 'lunch' | 'dinner' | string;
        if (mealType === 'breakfast' || mealType === 'lunch' || mealType === 'dinner') {
          mealData[mealType] = mealName;
          mealData[`${mealType}_recipe_id`] = this.selectedMeal.recipeId;
        }

        if (this.selectedMeal.mealSlotId != null) {
          mealData.slot_updates = [
            {
              meal_slot_id: this.selectedMeal.mealSlotId,
              dish: mealName,
              recipe_id: this.selectedMeal.recipeId,
            },
          ];
        }

        const { api } = useApi();
        const savedMeal = await api(
          `/api/meal-diaries/${userStore.user.family_group_id}/daily-meals`,
          {
            method: 'PATCH',
            body: mealData,
            silent: true,
          }
        );

        // Update local state
        const existingDayMeal = this.weeklyMeals.find(meal => meal.day_of_week === this.selectedMeal.dayOfWeek);
        if (existingDayMeal) {
          if (mealType === 'breakfast' || mealType === 'lunch' || mealType === 'dinner') {
            existingDayMeal[mealType] = mealName || null;
            const recipeIdKey = `${mealType}_recipe_id` as keyof Pick<DailyMeal, 'breakfast_recipe_id' | 'lunch_recipe_id' | 'dinner_recipe_id'>;
            (existingDayMeal as any)[recipeIdKey] = this.selectedMeal.recipeId;
          }
          if (Array.isArray(savedMeal?.slots) && savedMeal.slots.length > 0) {
            existingDayMeal.slots = savedMeal.slots;
          } else if (this.selectedMeal.mealSlotId != null) {
            if (!existingDayMeal.slots) {
              existingDayMeal.slots = [];
            }
            const slotIndex = existingDayMeal.slots.findIndex(
              (s) => s.meal_slot_id === this.selectedMeal.mealSlotId
            );
            if (slotIndex >= 0) {
              existingDayMeal.slots[slotIndex] = {
                ...existingDayMeal.slots[slotIndex],
                dish: mealName || null,
                recipe_id: this.selectedMeal.recipeId,
              };
            }
          }
        } else {
          this.weeklyMeals.push({
            day_of_week: this.selectedMeal.dayOfWeek,
            week_start_date:
              this.currentWeekStart || normalizeMealDiaryWeekKey(this.getWeekStartDate()),
            breakfast: mealType === 'breakfast' ? this.selectedMeal.name : null,
            lunch: mealType === 'lunch' ? this.selectedMeal.name : null,
            dinner: mealType === 'dinner' ? this.selectedMeal.name : null,
            breakfast_recipe_id: mealType === 'breakfast' ? this.selectedMeal.recipeId : null,
            lunch_recipe_id: mealType === 'lunch' ? this.selectedMeal.recipeId : null,
            dinner_recipe_id: mealType === 'dinner' ? this.selectedMeal.recipeId : null,
            slots: Array.isArray(savedMeal?.slots) ? savedMeal.slots : [],
          });
        }

        diaryRevision += 1;
        await this.saveToLocalStorage();
        this.resetSelectedMeal();
      } catch (error) {
        if (this.selectedMeal.mealSlotId != null && isSaveNetworkFailure(error)) {
          await this.queueSelectedSlot();
          this.resetSelectedMeal();
          if (this.browserIsOnline()) {
            await this.flushPending();
          }
          return;
        }
        console.error('Error saving meal:', error);
        if (!extractEntitlementError(error)) {
          const { showError } = useToast();
          showError(extractErrorMessage(error) || 'Failed to save meal');
        }
        throw error;
      }
    },

    async ensurePendingLoaded() {
      if (pendingReady) {
        return;
      }
      if (!pendingLoadPromise) {
        pendingLoadPromise = this.loadPending().finally(() => {
          pendingLoadPromise = null;
        });
      }
      await pendingLoadPromise;
    },

    async loadPending() {
      if (!import.meta.client) {
        pendingReady = true;
        return;
      }
      try {
        const { value } = await Preferences.get({ key: MEAL_DIARY_PENDING_KEY });
        if (!value) {
          this.pendingSlots = [];
        } else {
          const parsed = JSON.parse(value) as { slots?: unknown };
          const slots = Array.isArray(parsed?.slots) ? parsed.slots : [];
          this.pendingSlots = slots.filter(isMealDiaryPendingSlot).map(normalizePendingSlot);
        }
      } catch (error) {
        console.error('Failed to parse stored meal diary queue:', error);
        this.pendingSlots = [];
        await Preferences.remove({ key: MEAL_DIARY_PENDING_KEY });
      }
      pendingReady = true;
    },

    async persistPending() {
      if (!import.meta.client) {
        return;
      }
      await Preferences.set({
        key: MEAL_DIARY_PENDING_KEY,
        value: JSON.stringify({ slots: this.pendingSlots }),
      });
    },

    async dropUnmatchedPending(familyId: number) {
      await this.ensurePendingLoaded();
      const removed = this.pendingSlots.filter((slot) => slot.family_group_id !== familyId);
      if (!removed.length) {
        return;
      }
      this.pendingSlots = this.pendingSlots.filter((slot) => slot.family_group_id === familyId);
      this.conflicts = this.conflicts.filter(
        (conflict) =>
          !removed.some(
            (slot) =>
              weekKeysEqual(slot.week_start_date, conflict.week_start_date) &&
              slot.day_of_week === conflict.day_of_week &&
              slot.meal_slot_id === conflict.meal_slot_id
          )
      );
      if (
        this.reviewWeekStart &&
        !this.conflicts.some((conflict) => weekKeysEqual(conflict.week_start_date, this.reviewWeekStart))
      ) {
        this.advanceReview();
      }
      await this.persistPending();
    },

    pendingForSlot(familyId: number, weekStartDate: string, dayOfWeek: number, mealSlotId: number) {
      return this.pendingSlots.find(
        (slot) =>
          slot.family_group_id === familyId &&
          weekKeysEqual(slot.week_start_date, weekStartDate) &&
          slot.day_of_week === dayOfWeek &&
          slot.meal_slot_id === mealSlotId
      );
    },

    isSlotPending(weekStartDate: string, dayOfWeek: number, mealSlotId: number) {
      const familyId = this.signedInFamilyId();
      if (!familyId || !weekStartDate) {
        return false;
      }
      return !!this.pendingForSlot(familyId, weekStartDate, dayOfWeek, mealSlotId);
    },

    overlayPendingOntoCurrentWeek() {
      const familyId = this.signedInFamilyId();
      const weekStartDate = this.currentWeekStart;
      if (!familyId || !weekStartDate) {
        return;
      }
      for (const pending of this.pendingSlots) {
        if (pending.family_group_id !== familyId || !weekKeysEqual(pending.week_start_date, weekStartDate)) {
          continue;
        }
        const day = this.weeklyMeals.find((meal) => meal.day_of_week === pending.day_of_week);
        if (!day) {
          continue;
        }
        writeSlotValue(day, pending.meal_slot_id, slotValue(pending.dish, pending.recipe_id));
      }
    },

    async queueSelectedSlot() {
      const familyId = this.signedInFamilyId();
      const dayOfWeek = this.selectedMeal.dayOfWeek;
      const mealSlotId = this.selectedMeal.mealSlotId;
      if (!familyId || dayOfWeek == null || mealSlotId == null) {
        return;
      }
      const weekStartDate =
        this.currentWeekStart || normalizeMealDiaryWeekKey(this.getWeekStartDate());
      const next = slotValue(this.selectedMeal.name, this.selectedMeal.recipeId);
      const day = this.weeklyMeals.find((meal) => meal.day_of_week === dayOfWeek);
      const existing = this.pendingForSlot(familyId, weekStartDate, dayOfWeek, mealSlotId);
      const baseline = existing?.baseline ?? readSlotValue(day, mealSlotId, this.selectedMeal.type);

      if (mealDiarySlotValuesMatch(baseline, next)) {
        if (existing) {
          this.pendingSlots = this.pendingSlots.filter((slot) => slot !== existing);
          this.conflicts = this.conflicts.filter(
            (conflict) =>
              !(
                weekKeysEqual(conflict.week_start_date, weekStartDate) &&
                conflict.day_of_week === dayOfWeek &&
                conflict.meal_slot_id === mealSlotId
              )
          );
          if (
            this.reviewWeekStart &&
            !this.conflicts.some((conflict) =>
              weekKeysEqual(conflict.week_start_date, this.reviewWeekStart)
            )
          ) {
            this.advanceReview();
          }
          await this.persistPending();
        }
      } else {
        const pending: MealDiaryPendingSlot = {
          family_group_id: familyId,
          week_start_date: weekStartDate,
          day_of_week: dayOfWeek,
          meal_slot_id: mealSlotId,
          baseline,
          dish: next.dish,
          recipe_id: next.recipe_id,
        };
        if (existing) {
          const index = this.pendingSlots.indexOf(existing);
          this.pendingSlots.splice(index, 1, pending);
        } else {
          this.pendingSlots.push(pending);
        }
        await this.persistPending();
      }

      if (day) {
        writeSlotValue(day, mealSlotId, next);
      }
      diaryRevision += 1;
      await this.saveToLocalStorage();
    },

    clearEntitlementForWeek(weekStartDate: string) {
      const next = { ...this.syncEntitlementByWeek };
      let changed = false;
      for (const key of Object.keys(next)) {
        if (weekKeysEqual(key, weekStartDate)) {
          delete next[key];
          changed = true;
        }
      }
      if (changed) {
        this.syncEntitlementByWeek = next;
      }
    },

    noteSyncError(weekStartDate: string, error: unknown) {
      const entitlement = extractEntitlementError(error);
      if (entitlement?.feature === 'edit_past_weeks' || entitlement?.feature === 'weeks_ahead') {
        this.syncEntitlementByWeek = {
          ...this.syncEntitlementByWeek,
          [weekStartDate]: entitlement.feature,
        };
        return true;
      }
      return false;
    },

    slotName(weekDays: DailyMeal[], dayOfWeek: number, mealSlotId: number) {
      const fromServer = weekDays
        .find((day) => day.day_of_week === dayOfWeek)
        ?.slots?.find((slot) => slot.meal_slot_id === mealSlotId)?.name;
      if (fromServer) {
        return fromServer;
      }
      return (
        this.weeklyMeals
          .find((day) => day.day_of_week === dayOfWeek)
          ?.slots?.find((slot) => slot.meal_slot_id === mealSlotId)?.name || ''
      );
    },

    applyServerSlot(weekStartDate: string, dayOfWeek: number, mealSlotId: number) {
      const serverDay = serverWeeks
        .get(weekStartDate)
        ?.find((day) => day.day_of_week === dayOfWeek);
      const serverSlot = serverDay?.slots?.find((slot) => slot.meal_slot_id === mealSlotId);
      if (!serverSlot || !weekKeysEqual(this.currentWeekStart, weekStartDate)) {
        return;
      }
      const day = this.weeklyMeals.find((meal) => meal.day_of_week === dayOfWeek);
      if (!day) {
        return;
      }
      writeSlotValue(day, mealSlotId, slotValue(serverSlot.dish, serverSlot.recipe_id));
    },

    replaceVisibleWeek(weekStartDate: string, days: DailyMeal[], preserveKeys: Set<string>) {
      const cloned = cloneServerWeek(weekStartDate, days);
      serverWeeks.set(weekStartDate, cloned.map((day) => ({
        ...day,
        slots: (day.slots ?? []).map((slot) => ({ ...slot })),
      })));
      if (!weekKeysEqual(this.currentWeekStart, weekStartDate)) {
        return;
      }
      const familyId = this.signedInFamilyId();
      this.weeklyMeals = cloned.map((day) => {
        const slots = (day.slots ?? []).map((slot) => {
          const key = `${day.day_of_week}:${slot.meal_slot_id}`;
          if (!preserveKeys.has(key) || !familyId) {
            return slot;
          }
          const pending = this.pendingForSlot(familyId, weekStartDate, day.day_of_week, slot.meal_slot_id);
          if (!pending) {
            return slot;
          }
          return {
            ...slot,
            dish: pending.dish,
            recipe_id: pending.recipe_id,
          };
        });
        return applyLegacyColumnsFromSlots({
          ...day,
          week_start_date: weekStartDate,
          slots,
        });
      });
      diaryRevision += 1;
    },

    async consumeSyncResponse(weekStartDate: string, response: MealDiarySyncResponse) {
      const familyId = this.signedInFamilyId();
      const dailyMeals = Array.isArray(response?.dailyMeals) ? response.dailyMeals : [];
      const results = Array.isArray(response?.results) ? response.results : [];
      if (!familyId) {
        return;
      }

      for (const result of results) {
        if (!TERMINAL_SYNC_STATUSES.has(result.status)) {
          continue;
        }
        this.pendingSlots = this.pendingSlots.filter(
          (slot) =>
            !(
              slot.family_group_id === familyId &&
              weekKeysEqual(slot.week_start_date, weekStartDate) &&
              slot.day_of_week === result.day_of_week &&
              slot.meal_slot_id === result.meal_slot_id
            )
        );
        this.conflicts = this.conflicts.filter(
          (conflict) =>
            !(
              weekKeysEqual(conflict.week_start_date, weekStartDate) &&
              conflict.day_of_week === result.day_of_week &&
              conflict.meal_slot_id === result.meal_slot_id
            )
        );
      }

      for (const result of results) {
        if (result.status !== 'conflict') {
          continue;
        }
        const yours = result.yours ? slotValue(result.yours.dish, result.yours.recipe_id) : slotValue(null, null);
        const theirs = result.theirs ? slotValue(result.theirs.dish, result.theirs.recipe_id) : slotValue(null, null);
        const baseline = result.baseline
          ? slotValue(result.baseline.dish, result.baseline.recipe_id)
          : slotValue(null, null);
        const pending = this.pendingForSlot(familyId, weekStartDate, result.day_of_week, result.meal_slot_id);
        if (pending) {
          pending.dish = yours.dish;
          pending.recipe_id = yours.recipe_id;
          pending.baseline = baseline;
        }
        const nextConflict: MealDiarySyncConflict = {
          week_start_date: weekStartDate,
          day_of_week: result.day_of_week,
          meal_slot_id: result.meal_slot_id,
          slot_name: this.slotName(dailyMeals, result.day_of_week, result.meal_slot_id),
          yours,
          theirs,
          baseline,
        };
        const index = this.conflicts.findIndex(
          (conflict) =>
            weekKeysEqual(conflict.week_start_date, weekStartDate) &&
            conflict.day_of_week === result.day_of_week &&
            conflict.meal_slot_id === result.meal_slot_id
        );
        if (index >= 0) {
          this.conflicts.splice(index, 1, nextConflict);
        } else {
          this.conflicts.push(nextConflict);
        }
      }

      const preserveKeys = new Set(
        this.pendingSlots
          .filter(
            (slot) =>
              slot.family_group_id === familyId && weekKeysEqual(slot.week_start_date, weekStartDate)
          )
          .map((slot) => `${slot.day_of_week}:${slot.meal_slot_id}`)
      );
      if (dailyMeals.length) {
        this.replaceVisibleWeek(weekStartDate, dailyMeals, preserveKeys);
      }
      this.advanceReview();
      await this.persistPending();
      await this.saveToLocalStorage();
    },

    advanceReview() {
      if (
        this.reviewWeekStart &&
        this.conflicts.some((conflict) => weekKeysEqual(conflict.week_start_date, this.reviewWeekStart))
      ) {
        return;
      }
      const weeks = [...new Set(this.conflicts.map((conflict) => conflict.week_start_date))].sort();
      this.reviewWeekStart = weeks[0] ?? null;
    },

    discardConflictsForWeek(weekStartDate: string) {
      const familyId = this.signedInFamilyId();
      const rows = this.conflicts.filter((conflict) => weekKeysEqual(conflict.week_start_date, weekStartDate));
      for (const row of rows) {
        if (familyId) {
          this.pendingSlots = this.pendingSlots.filter(
            (slot) =>
              !(
                slot.family_group_id === familyId &&
                weekKeysEqual(slot.week_start_date, weekStartDate) &&
                slot.day_of_week === row.day_of_week &&
                slot.meal_slot_id === row.meal_slot_id
              )
          );
        }
        this.applyServerSlot(weekStartDate, row.day_of_week, row.meal_slot_id);
      }
      this.conflicts = this.conflicts.filter(
        (conflict) => !weekKeysEqual(conflict.week_start_date, weekStartDate)
      );
      if (weekKeysEqual(this.currentWeekStart, weekStartDate)) {
        diaryRevision += 1;
      }
    },

    async dismissOpenReview() {
      if (!this.reviewWeekStart) {
        return;
      }
      const weekStartDate = this.reviewWeekStart;
      this.discardConflictsForWeek(weekStartDate);
      this.advanceReview();
      await this.persistPending();
      await this.saveToLocalStorage();
    },

    async dismissAllReviews() {
      const weeks = [...new Set(this.conflicts.map((conflict) => conflict.week_start_date))];
      for (const weekStartDate of weeks) {
        this.discardConflictsForWeek(weekStartDate);
      }
      this.reviewWeekStart = null;
      await this.persistPending();
      await this.saveToLocalStorage();
    },

    async keepTheirs(conflict: MealDiarySyncConflict) {
      const familyId = this.signedInFamilyId();
      if (familyId) {
        this.pendingSlots = this.pendingSlots.filter(
          (slot) =>
            !(
              slot.family_group_id === familyId &&
              weekKeysEqual(slot.week_start_date, conflict.week_start_date) &&
              slot.day_of_week === conflict.day_of_week &&
              slot.meal_slot_id === conflict.meal_slot_id
            )
        );
      }
      this.conflicts = this.conflicts.filter(
        (row) =>
          !(
            weekKeysEqual(row.week_start_date, conflict.week_start_date) &&
            row.day_of_week === conflict.day_of_week &&
            row.meal_slot_id === conflict.meal_slot_id
          )
      );
      this.applyServerSlot(conflict.week_start_date, conflict.day_of_week, conflict.meal_slot_id);
      if (weekKeysEqual(this.currentWeekStart, conflict.week_start_date)) {
        diaryRevision += 1;
      }
      this.advanceReview();
      await this.persistPending();
      await this.saveToLocalStorage();
    },

    async keepAllTheirs() {
      await this.dismissOpenReview();
    },

    async keepMine(conflict: MealDiarySyncConflict) {
      await this.resolveConflicts([conflict]);
    },

    async keepAllMine() {
      if (!this.reviewWeekStart) {
        return;
      }
      const rows = this.conflicts.filter((conflict) =>
        weekKeysEqual(conflict.week_start_date, this.reviewWeekStart)
      );
      await this.resolveConflicts(rows);
    },

    resolveConflicts(rows: MealDiarySyncConflict[]) {
      return enqueueDiarySync(() => this.executeResolve(rows));
    },

    async executeResolve(rows: MealDiarySyncConflict[]) {
      const familyId = this.signedInFamilyId();
      const live = rows.filter((row) =>
        this.conflicts.some(
          (conflict) =>
            weekKeysEqual(conflict.week_start_date, row.week_start_date) &&
            conflict.day_of_week === row.day_of_week &&
            conflict.meal_slot_id === row.meal_slot_id
        )
      );
      if (!familyId || !live.length) {
        return;
      }
      const weekStartDate = live[0].week_start_date;
      this.syncing = true;
      try {
        const { api } = useApi();
        const response = await api<MealDiarySyncResponse>(
          `/api/meal-diaries/${familyId}/daily-meals/sync/resolve`,
          {
            method: 'POST',
            silent: true,
            suppressPaywall: true,
            body: {
              week_start_date: weekStartDate,
              keep_mine: live.map((row) => ({
                day_of_week: row.day_of_week,
                meal_slot_id: row.meal_slot_id,
                dish: normalizeMealDiaryDish(row.yours.dish),
                recipe_id: row.yours.recipe_id ?? null,
                expected: slotValue(row.theirs.dish, row.theirs.recipe_id),
                baseline: slotValue(row.baseline.dish, row.baseline.recipe_id),
              })),
            },
          }
        );
        this.clearEntitlementForWeek(weekStartDate);
        this.syncFailed = false;
        await this.consumeSyncResponse(weekStartDate, response);
      } catch (error) {
        if (!this.noteSyncError(weekStartDate, error)) {
          console.error('Error resolving meal diary sync:', error);
          this.syncFailed = true;
        }
      } finally {
        this.syncing = false;
      }
    },

    flushPending() {
      return enqueueDiarySync(() => this.executeFlush());
    },

    async executeFlush() {
      if (!import.meta.client) {
        return;
      }
      await this.ensurePendingLoaded();
      const familyId = this.signedInFamilyId();
      if (!familyId || !this.browserIsOnline()) {
        return;
      }
      await this.dropUnmatchedPending(familyId);
      const weeks = [
        ...new Set(
          this.pendingSlots
            .filter((slot) => slot.family_group_id === familyId)
            .map((slot) => slot.week_start_date)
        ),
      ].sort();
      if (!weeks.length) {
        this.syncFailed = false;
        return;
      }

      let failed = false;
      for (const weekStartDate of weeks) {
        const slots = this.pendingSlots.filter(
          (slot) =>
            slot.family_group_id === familyId && weekKeysEqual(slot.week_start_date, weekStartDate)
        );
        if (!slots.length) {
          continue;
        }
        try {
          const { api } = useApi();
          const response = await api<MealDiarySyncResponse>(
            `/api/meal-diaries/${familyId}/daily-meals/sync`,
            {
              method: 'POST',
              silent: true,
              suppressPaywall: true,
              body: {
                week_start_date: weekStartDate,
                slots: slots.map((slot) => ({
                  day_of_week: slot.day_of_week,
                  meal_slot_id: slot.meal_slot_id,
                  baseline: slot.baseline,
                  dish: slot.dish,
                  recipe_id: slot.recipe_id,
                })),
              },
            }
          );
          this.clearEntitlementForWeek(weekStartDate);
          await this.consumeSyncResponse(weekStartDate, response);
        } catch (error) {
          if (!this.noteSyncError(weekStartDate, error)) {
            console.error('Error syncing meal diary:', error);
            failed = true;
          }
        }
      }
      this.syncFailed = failed;
    },

    // Handle daily meal update from SSE
    handleDailyMealUpdate(dailyMeal: DailyMeal) {
      if (!dailyMeal) return;

      const incomingKey = dailyMeal.week_start_date
        ? normalizeMealDiaryWeekKey(dailyMeal.week_start_date)
        : '';
      const currentKey = this.currentWeekStart
        ? normalizeMealDiaryWeekKey(this.currentWeekStart)
        : '';

      if (incomingKey && currentKey && incomingKey !== currentKey) {
        return;
      }

      const weekKey = incomingKey || currentKey;
      const existingDayMealIndex = this.weeklyMeals.findIndex(
        (meal) => meal.day_of_week === dailyMeal.day_of_week
      );
      const prev = existingDayMealIndex !== -1 ? this.weeklyMeals[existingDayMealIndex] : null;
      const payload = dailyMeal as unknown as Record<string, unknown>;
      const hasSlots = Array.isArray(dailyMeal.slots);
      const isPending = (mealSlotId: number) =>
        !!weekKey && this.isSlotPending(weekKey, dailyMeal.day_of_week, mealSlotId);

      let next: DailyMeal;

      if (hasSlots && dailyMeal.slots) {
        const mergedSlots = dailyMeal.slots.map((slot) => {
          if (!isPending(slot.meal_slot_id)) {
            return { ...slot };
          }
          const pending = weekKey
            ? this.pendingForSlot(
                this.signedInFamilyId() ?? 0,
                weekKey,
                dailyMeal.day_of_week,
                slot.meal_slot_id
              )
            : undefined;
          const local = prev?.slots?.find((entry) => entry.meal_slot_id === slot.meal_slot_id);
          return {
            ...slot,
            dish: pending?.dish ?? local?.dish ?? slot.dish,
            recipe_id: pending?.recipe_id ?? local?.recipe_id ?? slot.recipe_id,
          };
        });
        next = restorePendingLegacyColumns(
          {
            ...(prev ?? {
              breakfast: null,
              lunch: null,
              dinner: null,
              breakfast_recipe_id: null,
              lunch_recipe_id: null,
              dinner_recipe_id: null,
              day_of_week: dailyMeal.day_of_week,
              week_start_date: weekKey,
            }),
            breakfast: dailyMeal.breakfast,
            lunch: dailyMeal.lunch,
            dinner: dailyMeal.dinner,
            breakfast_recipe_id: dailyMeal.breakfast_recipe_id,
            lunch_recipe_id: dailyMeal.lunch_recipe_id,
            dinner_recipe_id: dailyMeal.dinner_recipe_id,
            day_of_week: dailyMeal.day_of_week,
            week_start_date: weekKey || prev?.week_start_date || '',
            slots: mergedSlots,
          },
          isPending
        );
      } else if (prev) {
        next = {
          ...prev,
          breakfast: dailyMeal.breakfast,
          lunch: dailyMeal.lunch,
          dinner: dailyMeal.dinner,
        };
        const recipeKeys = [
          'breakfast_recipe_id',
          'lunch_recipe_id',
          'dinner_recipe_id',
        ] as const;
        for (const key of recipeKeys) {
          if (key in payload) {
            next[key] = dailyMeal[key];
          }
        }
        if (prev.slots?.length) {
          next.slots = prev.slots.map((slot) => {
            if (isPending(slot.meal_slot_id)) {
              return { ...slot };
            }
            if (
              slot.legacy_key === 'breakfast' ||
              slot.legacy_key === 'lunch' ||
              slot.legacy_key === 'dinner'
            ) {
              const recipeKey = `${slot.legacy_key}_recipe_id` as const;
              return {
                ...slot,
                dish: dailyMeal[slot.legacy_key],
                recipe_id: recipeKey in payload ? dailyMeal[recipeKey] ?? null : slot.recipe_id,
              };
            }
            return { ...slot };
          });
        }
        next = restorePendingLegacyColumns(next, isPending);
      } else {
        next = {
          ...dailyMeal,
          week_start_date:
            currentKey ||
            incomingKey ||
            normalizeMealDiaryWeekKey(this.getWeekStartDate()),
        };
      }

      if (existingDayMealIndex !== -1) {
        this.weeklyMeals[existingDayMealIndex] = next;
      } else {
        this.weeklyMeals.push(next);
      }

      // Save to Preferences after receiving update (debounced — SSE can send many events)
      this.schedulePersistToLocalStorage();
    },

    // Update meals from events
    updateMealsFromEvents(events: any[]) {
      // Process events and update weekly meals
      events.forEach(event => {
        if (event.type === 'update-daily-meal') {
          this.handleDailyMealUpdate(event.data.dailyMeal);
        }
      });
    }
  },
});
