import type { QueryClient } from '@tanstack/react-query';

import { normalizeMealDiaryWeekKey } from '@/lib/diary/mealDiaryWeekKey';
import { saveWeeklyMealsCache } from '@/lib/diary/mealDiaryStorage';
import { mealDiaryKeys } from '@/lib/queries/mealDiary';
import { setShoppingListQueryData } from '@/lib/queries/shoppingList';
import type { DailyMeal } from '@/types/mealDiary';
import type { ShoppingListItem } from '@/types/shoppingList';

interface ShoppingListEventData {
  item?: ShoppingListItem;
  actorUserId?: number | null;
}

interface DailyMealEventData {
  dailyMeal?: Partial<DailyMeal> & {
    day_of_week: number;
  };
}

interface InitialEventData {
  shoppingList?: Array<{ type: string; data: ShoppingListEventData }>;
  mealDiary?: Array<{ type: string; data: DailyMealEventData }>;
}

function isOwnActor(actorUserId: number | null | undefined, currentUserId: number | undefined): boolean {
  return actorUserId != null && currentUserId != null && actorUserId === currentUserId;
}

function applyShoppingListEvent(
  queryClient: QueryClient,
  familyGroupId: number,
  eventType: string,
  data: ShoppingListEventData,
  currentUserId: number | undefined
): void {
  if (eventType === 'add-item' || eventType === 'delete-item') {
    const actorId = data.actorUserId ?? data.item?.created_by;
    if (isOwnActor(actorId, currentUserId)) {
      return;
    }
  } else if (isOwnActor(data.actorUserId, currentUserId)) {
    return;
  }

  if (!data.item?.id) {
    return;
  }

  const item = data.item;

  setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) => {
    if (!shoppingList) {
      return shoppingList;
    }

    if (eventType === 'add-item') {
      const existingIndex = shoppingList.items.findIndex((entry) => entry.id === item.id);
      if (existingIndex === -1) {
        return {
          ...shoppingList,
          items: [...shoppingList.items, item],
        };
      }

      const nextItems = [...shoppingList.items];
      nextItems[existingIndex] = item;
      return { ...shoppingList, items: nextItems };
    }

    if (eventType === 'delete-item') {
      return {
        ...shoppingList,
        items: shoppingList.items.filter((entry) => entry.id !== item.id),
      };
    }

    const index = shoppingList.items.findIndex((entry) => entry.id === item.id);
    if (index === -1) {
      return shoppingList;
    }

    const nextItems = [...shoppingList.items];
    if (eventType === 'check-item') {
      nextItems[index] = { ...nextItems[index], checked: true };
    } else if (eventType === 'uncheck-item') {
      nextItems[index] = { ...nextItems[index], checked: false };
    } else if (eventType === 'move-item') {
      nextItems[index] = {
        ...nextItems[index],
        parent_item_id: item.parent_item_id ?? null,
        position: item.position,
      };
    } else {
      return shoppingList;
    }

    return { ...shoppingList, items: nextItems };
  });
}

function applyDailyMealEvent(
  queryClient: QueryClient,
  familyGroupId: number,
  data: DailyMealEventData
): void {
  const dailyMeal = data.dailyMeal;
  if (!dailyMeal?.day_of_week) {
    return;
  }

  const weekKey = dailyMeal.week_start_date
    ? normalizeMealDiaryWeekKey(dailyMeal.week_start_date)
    : '';
  if (!weekKey) {
    return;
  }

  const queryKey = mealDiaryKeys.weekly(familyGroupId, weekKey);
  const existing = queryClient.getQueryData<DailyMeal[]>(queryKey);
  if (!existing) {
    return;
  }

  const merged: DailyMeal = {
    day_of_week: dailyMeal.day_of_week,
    breakfast: dailyMeal.breakfast ?? null,
    lunch: dailyMeal.lunch ?? null,
    dinner: dailyMeal.dinner ?? null,
    breakfast_recipe_id: dailyMeal.breakfast_recipe_id ?? null,
    lunch_recipe_id: dailyMeal.lunch_recipe_id ?? null,
    dinner_recipe_id: dailyMeal.dinner_recipe_id ?? null,
    week_start_date: weekKey,
  };

  queryClient.setQueryData<DailyMeal[]>(queryKey, (weeklyMeals) => {
    if (!weeklyMeals) {
      return weeklyMeals;
    }

    const index = weeklyMeals.findIndex((meal) => meal.day_of_week === merged.day_of_week);
    const next = [...weeklyMeals];
    if (index === -1) {
      next.push(merged);
    } else {
      const prev = next[index];
      next[index] = {
        ...prev,
        breakfast: merged.breakfast,
        lunch: merged.lunch,
        dinner: merged.dinner,
        breakfast_recipe_id:
          'breakfast_recipe_id' in dailyMeal
            ? merged.breakfast_recipe_id
            : prev.breakfast_recipe_id,
        lunch_recipe_id:
          'lunch_recipe_id' in dailyMeal ? merged.lunch_recipe_id : prev.lunch_recipe_id,
        dinner_recipe_id:
          'dinner_recipe_id' in dailyMeal ? merged.dinner_recipe_id : prev.dinner_recipe_id,
        week_start_date: weekKey,
      };
    }

    void saveWeeklyMealsCache(familyGroupId, weekKey, next);
    return next;
  });
}

export function applyFamilyRealtimeEvent(
  queryClient: QueryClient,
  familyGroupId: number,
  eventType: string,
  data: unknown,
  currentUserId: number | undefined
): void {
  if (eventType === 'ping' || eventType === 'error') {
    return;
  }

  if (eventType === 'initial') {
    const initial = data as InitialEventData;
    for (const event of initial.shoppingList ?? []) {
      applyShoppingListEvent(queryClient, familyGroupId, event.type, event.data, currentUserId);
    }
    for (const event of initial.mealDiary ?? []) {
      if (event.type === 'update-daily-meal') {
        applyDailyMealEvent(queryClient, familyGroupId, event.data);
      }
    }
    return;
  }

  if (
    eventType === 'add-item' ||
    eventType === 'delete-item' ||
    eventType === 'check-item' ||
    eventType === 'uncheck-item' ||
    eventType === 'move-item'
  ) {
    applyShoppingListEvent(
      queryClient,
      familyGroupId,
      eventType,
      data as ShoppingListEventData,
      currentUserId
    );
    return;
  }

  if (eventType === 'update-daily-meal') {
    applyDailyMealEvent(queryClient, familyGroupId, data as DailyMealEventData);
  }
}
