<template>
  <div class="p-4">
    <div class="flex flex-col md:flex-row gap-4">
      <!-- <div class="form-control w-full max-w-xs">
        <label class="label">
          <span class="label-text">Year</span>
        </label>
        <input
          v-model.number="selectedYear"
          type="number"
          placeholder="Year"
          class="input input-bordered w-full max-w-xs"
          @input="updateWeeks"
        />
      </div> -->

      <div class="form-control w-full max-w-xs mx-auto text-center">
        <label class="label">
          <span class="label-text">{{ $t('Week Selection') }}</span>
        </label>
        <div class="flex flex-row gap-2">
          <button class="btn btn-primary" @click="selectedWeek = selectedWeek - 1">
            <fa icon="chevron-left" />
          </button>
          <select
            v-model.number="selectedWeek"
            class="select select-bordered"
          >
            <option v-for="week in weeks" :key="week.number" :value="week.number">
              {{ $t('Week') }} {{ week.number }} ({{ week.startDate.toLocaleDateString() }} - {{ week.endDate.toLocaleDateString() }})
            </option>
          </select>
          <button class="btn btn-primary" @click="selectedWeek = selectedWeek + 1">
            <fa icon="chevron-right" />
          </button>
        </div>
      </div>
    </div>

    <!-- <div v-if="selectedWeek" class="mt-4">
      <p class="text-lg">Selected Week: <strong>Week {{ selectedWeek }}, {{ selectedYear }}</strong></p>
      <p>Date Range: <strong>{{ startDate.toLocaleDateString() }} - {{ endDate.toLocaleDateString() }}</strong></p>
    </div> -->
  </div>
</template>

<script setup>
import { ref, computed, watchEffect } from 'vue';

// Calculate the start date of a given week and year.
const getFirstDayOfWeek = (year, week) => {
  const januaryFirst = new Date(year, 0, 1);
  const dayOfWeek = januaryFirst.getDay(); // 0 (Sunday) to 6 (Saturday)
  const firstMonday = new Date(year, 0, 1 + (8 - dayOfWeek) % 7);
  const startDate = new Date(firstMonday);
  startDate.setDate(firstMonday.getDate() + (week - 1) * 7);
  return startDate;
};

// get the current week number
const getCurrentWeekNumber = () => {
  const today = new Date();
  const year = today.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfWeek = firstDayOfYear.getDay();
  const firstMonday = new Date(year, 0, 1 + (8 - dayOfWeek) % 7);
  const diff = today - firstMonday;
  const weekNumber = Math.ceil(diff / (1000 * 60 * 60 * 24 * 7))
  return weekNumber;
};

const selectedYear = ref(new Date().getFullYear());
const selectedWeek = ref(getCurrentWeekNumber());
const weeks = ref([]);

const startDate = computed(() => {
  return getFirstDayOfWeek(selectedYear.value, selectedWeek.value);
});
const endDate = computed(() => {
  const end = new Date(startDate.value);
  end.setDate(startDate.value.getDate() + 6);
  return end;
});

const updateWeeks = () => {
  weeks.value = [];
  const year = selectedYear.value;

  const firstDayOfYear = new Date(year, 0, 1);
  const lastDayOfYear = new Date(year, 11, 31);
  let dayOfWeek = firstDayOfYear.getDay();
  const firstMonday = new Date(year, 0, 1 + (8 - dayOfWeek) % 7);
  let daysUntilEndOfYear = (lastDayOfYear - firstMonday) / (1000 * 60 * 60 * 24);
  let numWeeks = Math.ceil(daysUntilEndOfYear / 7) + 1;

  for (let i = 1; i <= numWeeks; i++) {
    const weekStartDate = getFirstDayOfWeek(year, i);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    weeks.value.push({
      number: i,
      startDate: weekStartDate,
      endDate: weekEndDate,
    });
  }

    // Ensure selectedWeek is valid for the current year
    if (!weeks.value.some(w => w.number === selectedWeek.value)) {
      selectedWeek.value = getCurrentWeekNumber(); // Reset to the current week of selected year.
      //If current week doesn't exist, then default to the last week of the year
      if (!weeks.value.some(w => w.number === selectedWeek.value)){
        selectedWeek.value = weeks.value[weeks.value.length - 1].number
      }
    }
};

// --- Lifecycle Hooks ---
watchEffect(() => {
  updateWeeks();
});

</script>