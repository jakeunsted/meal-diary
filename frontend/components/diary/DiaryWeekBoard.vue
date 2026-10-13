<template>
  <div class="overflow-x-auto px-3 pb-3" data-testid="diary-week-board">
    <div class="grid grid-cols-7 gap-2 min-w-[60rem]">
      <DiaryDayColumn
        v-for="dayMeal in mealDiaryStore.weeklyMeals"
        :key="`${resolvedWeekKey}-${dayMeal.day_of_week}`"
        :day="getDayName(dayMeal.day_of_week, dayMeal.week_start_date)"
        :date="getDateForDay(dayMeal.week_start_date, dayMeal.day_of_week)"
        :breakfast="{ name: dayMeal.breakfast, recipeId: dayMeal.breakfast_recipe_id }"
        :lunch="{ name: dayMeal.lunch, recipeId: dayMeal.lunch_recipe_id }"
        :dinner="{ name: dayMeal.dinner, recipeId: dayMeal.dinner_recipe_id }"
        :slots="dayMeal.slots || []"
        :readOnly="isWeekReadOnly"
        @setMeal="(payload) => handleSetMeal(payload, dayMeal.day_of_week)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import DiaryDayColumn from '~/components/diary/DiaryDayColumn.vue';

const {
  mealDiaryStore,
  resolvedWeekKey,
  isWeekReadOnly,
  getDayName,
  getDateForDay,
  handleSetMeal,
} = useDiaryScreenContext();
</script>
