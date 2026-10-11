import { useCallback, useState } from 'react';

import { buildSaveDailyMealPayload } from '@/lib/diary/buildSaveDailyMealPayload';
import { resolveMealDiaryErrorMessage, useSaveDailyMeal } from '@/lib/queries/mealDiary';
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

export function useMealDiaryEditor() {
  const [selectedMeal, setSelectedMeal] = useState<SelectedMeal>(emptySelectedMeal);
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

  const performSave = useCallback(
    async (
      familyGroupId: number,
      weekKey: string,
      weeklyMeals: DailyMeal[],
      mealType: MealType | null,
      dayOfWeek: number,
      mealName: string,
      recipeId: number | null,
      mealSlotId: number | null
    ) => {
      setSaveError(null);

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
        closeMealEditor();
      } catch (error) {
        setSaveError(resolveMealDiaryErrorMessage(error));
      }
    },
    [closeMealEditor, saveDailyMealMutation]
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
        selectedMeal.mealSlotId
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
