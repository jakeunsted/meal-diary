<template>
  <div class="p-4">
    <div class="flex flex-col md:flex-row gap-4">
      <div class="form-control w-full max-w-xs mx-auto text-center">
        <label class="label">
          <span class="label-text">{{ $t('Week Selection') }}</span>
        </label>
        <div class="flex flex-row gap-2">
          <button 
            class="btn btn-primary" 
            @click="handlePreviousWeek"
            :disabled="!canGoBack"
          >
            <fa icon="chevron-left" />
          </button>
          <select
            v-model.number="selectedWeek"
            class="select select-bordered"
          >
            <option v-for="week in filteredWeeks" :key="week.number" :value="week.number">
              {{ $t('Week') }} {{ week.number }} ({{ week.startDate.toLocaleDateString() }} - {{ week.endDate.toLocaleDateString() }})
            </option>
          </select>
          <button 
            class="btn btn-primary" 
            @click="handleNextWeek"
            :disabled="!canGoForward"
          >
            <fa icon="chevron-right" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watchEffect } from 'vue';

// Calculate the start date of a given week and year.
const normalizeDate = (date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const getFirstDayOfWeek = (year, week) => {
  const januaryFirst = new Date(year, 0, 1);
  const dayOfWeek = januaryFirst.getDay(); // 0 (Sunday) to 6 (Saturday)
  const firstMonday = new Date(year, 0, 1 + (8 - dayOfWeek) % 7);
  const startDate = new Date(firstMonday);
  startDate.setDate(firstMonday.getDate() + (week - 1) * 7);
  return normalizeDate(startDate);
};

// get the current week number
const getCurrentWeekNumber = () => {
  const today = normalizeDate(new Date());
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

// Calculate the current week number for comparison
const currentWeekNumber = getCurrentWeekNumber();

// Filter weeks to only show 3 weeks before and after the current week
// TODO: Might want to make it paid only to show more than current and previous weeks
const filteredWeeks = computed(() => {
  return weeks.value.filter(week => {
    const weekDiff = Math.abs(week.number - currentWeekNumber);
    return weekDiff <= 3;
  });
});

// Navigation controls
const canGoBack = computed(() => {
  return selectedWeek.value > Math.min(...filteredWeeks.value.map(w => w.number));
});

const canGoForward = computed(() => {
  return selectedWeek.value < Math.max(...filteredWeeks.value.map(w => w.number));
});

// Event handlers
const handlePreviousWeek = () => {
  if (canGoBack.value) {
    selectedWeek.value--;
  }
};

const handleNextWeek = () => {
  if (canGoForward.value) {
    selectedWeek.value++;
  }
};

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

watchEffect(() => {
  updateWeeks();
});

// Emit the selected week's start date when it changes
const emit = defineEmits(['weekChange']);

watch(selectedWeek, () => {
  const weekStartDate = normalizeDate(getFirstDayOfWeek(selectedYear.value, selectedWeek.value));
  emit('weekChange', weekStartDate);
});
</script>