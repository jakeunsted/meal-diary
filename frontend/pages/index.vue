<template>
  <div class="">
    <WeekCalendarPicker />
    <div class="">
      <DayFoodPlanCard day="Monday" />
      <DayFoodPlanCard day="Tuesday" />
      <DayFoodPlanCard day="Wednesday" />
      <DayFoodPlanCard day="Thursday" />
      <DayFoodPlanCard day="Friday" />
      <DayFoodPlanCard day="Saturday" />
      <DayFoodPlanCard day="Sunday" />
    </div>
  </div>
</template>

<script setup>
import WeekCalendarPicker from '~/components/WeekCalendarPicker.vue';
import DayFoodPlanCard from '~/components/diary/DayFoodPlanCard.vue';
</script>
