import { useQueryClient } from '@tanstack/react-query';
import { normalizeMealDiaryDish } from '@meal-diary/shared';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { isNetworkError } from '@/lib/auth/httpError';
import { buildSaveDailyMealPayload } from '@/lib/diary/buildSaveDailyMealPayload';
import {
  mealDiaryWeekHasPending,
  recordMealDiaryPendingEdit,
} from '@/lib/diary/mealDiaryPendingQueue';
import { saveWeeklyMealsCache } from '@/lib/diary/mealDiaryStorage';
import { applyLocalSlotValue } from '@/lib/diary/mealDiarySlotState';
import { mealDiaryKeys, resolveMealDiaryErrorMessage, useSaveDailyMeal } from '@/lib/queries/mealDiary';
import type { DailyMeal, MealType, SelectedMeal } from '@/types/mealDiary';

const emptySelectedMeal: SelectedMeal = {
  type: null,
  mealSlotId: null,
  dayOfWeek: null,
  name: '',
  recipeId: null,
};

function getExistingMealValues(
  dayMeal: DailyMeal | undefined,
  mealType: MealType | null,
  mealSlotId: number | null
): { name: string; recipeId: number | null } {
  if (!dayMeal) {
    return { name: '', recipeId: null };
  }

  if (mealSlotId != null && dayMeal.slots?.length) {
    const slot = dayMeal.slots.find((entry) => entry.meal_slot_id === mealSlotId);
    return {
      name: slot?.dish || '',
      recipeId: slot?.recipe_id ?? null,
    };
  }

  if (!mealType) {
    return { name: '', recipeId: null };
  }

  const recipeIdKey = `${mealType}_recipe_id` as
    | 'breakfast_recipe_id'
    | 'lunch_recipe_id'
    | 'dinner_recipe_id';

  return {
    name: dayMeal[mealType] || '',
    recipeId: dayMeal[recipeIdKey] ?? null,
  };
}

function resolveMealSlotId(
  weeklyMeals: DailyMeal[],
  dayOfWeek: number,
  mealType: MealType | null,
  mealSlotId: number | null
): number | null {
  if (mealSlotId != null) {
    return mealSlotId;
  }
  if (!mealType) {
    return null;
  }
  const dayMeal = weeklyMeals.find((meal) => meal.day_of_week === dayOfWeek);
  return dayMeal?.slots?.find((slot) => slot.legacy_key === mealType)?.meal_slot_id ?? null;
}

function readDeviceSlotValue(
  weeklyMeals: DailyMeal[],
  dayOfWeek: number,
  mealType: MealType | null,
  mealSlotId: number
): { dish: string | null; recipe_id: number | null } {
  const dayMeal = weeklyMeals.find((meal) => meal.day_of_week === dayOfWeek);
  const slot = dayMeal?.slots?.find((entry) => entry.meal_slot_id === mealSlotId);
  if (slot) {
    return {
      dish: normalizeMealDiaryDish(slot.dish),
      recipe_id: slot.recipe_id ?? null,
    };
  }
  if (dayMeal && mealType) {
    const recipeIdKey = `${mealType}_recipe_id` as
      | 'breakfast_recipe_id'
      | 'lunch_recipe_id'
      | 'dinner_recipe_id';
    return {
      dish: normalizeMealDiaryDish(dayMeal[mealType]),
      recipe_id: dayMeal[recipeIdKey] ?? null,
    };
  }
  return { dish: null, recipe_id: null };
}

export function useMealDiaryEditor() {
  const queryClient = useQueryClient();
  const [selectedMeal, setSelectedMeal] = useState<SelectedMeal>(emptySelectedMeal);
  const [openedWithMeal, setOpenedWithMeal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveDailyMealMutation = useSaveDailyMeal();

  const isModalVisible =
    (selectedMeal.type !== null || selectedMeal.mealSlotId !== null) &&
    selectedMeal.dayOfWeek !== null;

  const openMealEditor = useCallback(
    (
      mealType: MealType | null,
      dayOfWeek: number,
      weeklyMeals: DailyMeal[],
      mealSlotId: number | null = null
    ) => {
      const dayMeal = weeklyMeals.find((meal) => meal.day_of_week === dayOfWeek);
      const existing = getExistingMealValues(dayMeal, mealType, mealSlotId);

      setSelectedMeal({
        type: mealType,
        mealSlotId,
        dayOfWeek,
        name: existing.name,
        recipeId: existing.recipeId,
      });
      setOpenedWithMeal(!!(existing.name.trim() || existing.recipeId));
      setSaveError(null);
    },
    []
  );

  const closeMealEditor = useCallback(() => {
    setSelectedMeal(emptySelectedMeal);
    setSaveError(null);
  }, []);

  const updateMealName = useCallback((name: string) => {
    setSelectedMeal((current) => ({
      ...current,
      name,
      recipeId: null,
    }));
  }, []);

  const updateRecipeSelection = useCallback((recipeId: number | null, name: string) => {
    setSelectedMeal((current) => ({
      ...current,
      recipeId,
      name,
    }));
  }, []);

  const queueOfflineEdit = useCallback(
    async (
      familyGroupId: number,
      weekKey: string,
      weeklyMeals: DailyMeal[],
      mealType: MealType | null,
      dayOfWeek: number,
      mealName: string,
      recipeId: number | null,
      mealSlotId: number
    ) => {
      const dish = normalizeMealDiaryDish(mealName);
      const nextRecipeId = recipeId ?? null;
      await recordMealDiaryPendingEdit(familyGroupId, {
        week_start_date: weekKey,
        day_of_week: dayOfWeek,
        meal_slot_id: mealSlotId,
        baseline: readDeviceSlotValue(weeklyMeals, dayOfWeek, mealType, mealSlotId),
        dish,
        recipe_id: nextRecipeId,
      });
      const nextMeals = applyLocalSlotValue(
        weeklyMeals,
        weekKey,
        dayOfWeek,
        mealSlotId,
        mealType,
        dish,
        nextRecipeId
      );
      queryClient.setQueryData(mealDiaryKeys.weekly(familyGroupId, weekKey), nextMeals);
      await saveWeeklyMealsCache(familyGroupId, weekKey, nextMeals);
    },
    [queryClient]
  );

  const performSave = useCallback(
    async (
      familyGroupId: number,
      weekKey: string,
      weeklyMeals: DailyMeal[],
      mealType: MealType | null,
      dayOfWeek: number,
      mealName: string,
      recipeId: number | null,
      mealSlotId: number | null,
      recordSavedEvent = false
    ) => {
      setSaveError(null);
      const resolvedMealSlotId = resolveMealSlotId(
        weeklyMeals,
        dayOfWeek,
        mealType,
        mealSlotId
      );
      if (
        Platform.OS === 'android' &&
        resolvedMealSlotId != null &&
        (await mealDiaryWeekHasPending(familyGroupId, weekKey))
      ) {
        await queueOfflineEdit(
          familyGroupId,
          weekKey,
          weeklyMeals,
          mealType,
          dayOfWeek,
          mealName,
          recipeId,
          resolvedMealSlotId
        );
        if (recordSavedEvent) {
          captureEvent('diary_meal_saved');
        }
        closeMealEditor();
        return;
      }

      try {
        const payload = buildSaveDailyMealPayload(
          weeklyMeals,
          weekKey,
          dayOfWeek,
          mealType,
          mealName,
          recipeId,
          mealSlotId
        );

        await saveDailyMealMutation.mutateAsync({ familyGroupId, payload });
        if (recordSavedEvent) {
          captureEvent('diary_meal_saved');
        }
        closeMealEditor();
      } catch (error) {
        if (Platform.OS === 'android' && resolvedMealSlotId != null && isNetworkError(error)) {
          await queueOfflineEdit(
            familyGroupId,
            weekKey,
            weeklyMeals,
            mealType,
            dayOfWeek,
            mealName,
            recipeId,
            resolvedMealSlotId
          );
          if (recordSavedEvent) {
            captureEvent('diary_meal_saved');
          }
          closeMealEditor();
          return;
        }
        captureException(error, { category: 'diary' });
        setSaveError(resolveMealDiaryErrorMessage(error));
      }
    },
    [closeMealEditor, queueOfflineEdit, saveDailyMealMutation]
  );

  const handleSave = useCallback(
    async (familyGroupId: number | undefined, weekKey: string, weeklyMeals: DailyMeal[]) => {
      if (
        !familyGroupId ||
        selectedMeal.dayOfWeek === null ||
        (selectedMeal.type === null && selectedMeal.mealSlotId === null)
      ) {
        return;
      }

      await performSave(
        familyGroupId,
        weekKey,
        weeklyMeals,
        selectedMeal.type,
        selectedMeal.dayOfWeek,
        selectedMeal.name,
        selectedMeal.recipeId,
        selectedMeal.mealSlotId,
        true
      );
    },
    [performSave, selectedMeal]
  );

  const handleClear = useCallback(
    async (familyGroupId: number | undefined, weekKey: string, weeklyMeals: DailyMeal[]) => {
      if (
        !familyGroupId ||
        selectedMeal.dayOfWeek === null ||
        (selectedMeal.type === null && selectedMeal.mealSlotId === null)
      ) {
        return;
      }

      setSelectedMeal((current) => ({
        ...current,
        name: '',
        recipeId: null,
      }));

      await performSave(
        familyGroupId,
        weekKey,
        weeklyMeals,
        selectedMeal.type,
        selectedMeal.dayOfWeek,
        '',
        null,
        selectedMeal.mealSlotId
      );
    },
    [performSave, selectedMeal.dayOfWeek, selectedMeal.mealSlotId, selectedMeal.type]
  );

  return {
    selectedMeal,
    openedWithMeal,
    isModalVisible,
    isSaving: saveDailyMealMutation.isPending,
    saveError,
    openMealEditor,
    closeMealEditor,
    updateMealName,
    updateRecipeSelection,
    handleSave,
    handleClear,
  };
}
