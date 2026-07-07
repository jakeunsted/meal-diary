import { useCallback, useState } from 'react';

import { buildSaveDailyMealPayload } from '@/lib/diary/buildSaveDailyMealPayload';
import { resolveMealDiaryErrorMessage, useSaveDailyMeal } from '@/lib/queries/mealDiary';
import type { DailyMeal, MealType, SelectedMeal } from '@/types/mealDiary';

const emptySelectedMeal: SelectedMeal = {
  type: null,
  dayOfWeek: null,
  name: '',
  recipeId: null,
};

function getExistingMealValues(
  dayMeal: DailyMeal | undefined,
  mealType: MealType
): { name: string; recipeId: number | null } {
  if (!dayMeal) {
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

  const isModalVisible = selectedMeal.type !== null && selectedMeal.dayOfWeek !== null;

  const openMealEditor = useCallback((mealType: MealType, dayOfWeek: number, weeklyMeals: DailyMeal[]) => {
    const dayMeal = weeklyMeals.find((meal) => meal.day_of_week === dayOfWeek);
    const existing = getExistingMealValues(dayMeal, mealType);

    setSelectedMeal({
      type: mealType,
      dayOfWeek,
      name: existing.name,
      recipeId: existing.recipeId,
    });
    setSaveError(null);
  }, []);

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

  const performSave = useCallback(
    async (
      familyGroupId: number,
      weekKey: string,
      weeklyMeals: DailyMeal[],
      mealType: MealType,
      dayOfWeek: number,
      mealName: string,
      recipeId: number | null
    ) => {
      setSaveError(null);

      try {
        const payload = buildSaveDailyMealPayload(
          weeklyMeals,
          weekKey,
          dayOfWeek,
          mealType,
          mealName,
          recipeId
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
      if (!familyGroupId || !selectedMeal.type || selectedMeal.dayOfWeek === null) {
        return;
      }

      await performSave(
        familyGroupId,
        weekKey,
        weeklyMeals,
        selectedMeal.type,
        selectedMeal.dayOfWeek,
        selectedMeal.name,
        selectedMeal.recipeId
      );
    },
    [performSave, selectedMeal]
  );

  const handleClear = useCallback(
    async (familyGroupId: number | undefined, weekKey: string, weeklyMeals: DailyMeal[]) => {
      if (!familyGroupId || !selectedMeal.type || selectedMeal.dayOfWeek === null) {
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
        null
      );
    },
    [performSave, selectedMeal.dayOfWeek, selectedMeal.type]
  );

  return {
    selectedMeal,
    isModalVisible,
    isSaving: saveDailyMealMutation.isPending,
    saveError,
    openMealEditor,
    closeMealEditor,
    updateMealName,
    handleSave,
    handleClear,
  };
}
