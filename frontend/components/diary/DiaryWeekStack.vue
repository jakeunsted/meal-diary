<template>
  <div data-testid="diary-week-stack">
    <DayFoodPlanCard
      v-for="dayMeal in mealDiaryStore.weeklyMeals"
      :key="`${resolvedWeekKey}-${dayMeal.day_of_week}`"
      :day="getDayName(dayMeal.day_of_week, dayMeal.week_start_date)"
      :date="getDateForDay(dayMeal.week_start_date, dayMeal.day_of_week)"
      :breakfast="{ name: dayMeal.breakfast, recipeId: dayMeal.breakfast_recipe_id }"
      :lunch="{ name: dayMeal.lunch, recipeId: dayMeal.lunch_recipe_id }"
      :dinner="{ name: dayMeal.dinner, recipeId: dayMeal.dinner_recipe_id }"
      :slots="dayMeal.slots || []"
      :isPastDay="isDayInPast(dayMeal.week_start_date, dayMeal.day_of_week)"
      :readOnly="isWeekReadOnly"
      @setMeal="(payload) => handleSetMeal(payload, dayMeal.day_of_week)"
    />
  </div>
</template>

<script setup lang="ts">
import DayFoodPlanCard from '~/components/diary/DayFoodPlanCard.vue';

const {
  mealDiaryStore,
  resolvedWeekKey,
  isWeekReadOnly,
  getDayName,
  getDateForDay,
  isDayInPast,
  handleSetMeal,
} = useDiaryScreenContext();
</script>
