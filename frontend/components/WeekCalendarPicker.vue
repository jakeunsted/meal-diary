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
import { ref, computed, watchEffect, watch } from 'vue';

const props = defineProps({
  initialWeekStartDate: {
    type: Date,
    default: null
  }
});

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

// Get week number and year for a given date
// Returns { year, weekNumber } to handle cross-year weeks
const getWeekInfoForDate = (date) => {
  const normalizedDate = normalizeDate(new Date(date));
  const year = normalizedDate.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfWeek = firstDayOfYear.getDay();
  const firstMonday = new Date(year, 0, 1 + (8 - dayOfWeek) % 7);
  
  // If the date is before the first Monday of the year, it belongs to the last week of the previous year
  if (normalizedDate < firstMonday) {
    const previousYear = year - 1;
    const prevYearFirstDay = new Date(previousYear, 0, 1);
    const prevYearDayOfWeek = prevYearFirstDay.getDay();
    const prevYearFirstMonday = new Date(previousYear, 0, 1 + (8 - prevYearDayOfWeek) % 7);
    const prevYearLastDay = new Date(previousYear, 11, 31);
    const daysInPrevYear = (prevYearLastDay - prevYearFirstMonday) / (1000 * 60 * 60 * 24);
    const prevYearNumWeeks = Math.ceil(daysInPrevYear / 7) + 1;
    
    return {
      year: previousYear,
      weekNumber: prevYearNumWeeks
    };
  }
  
  // Otherwise, calculate the week number normally
  // Week 1 starts on the first Monday (diff = 0)
  // Days 0-6 are week 1, days 7-13 are week 2, etc.
  const diff = normalizedDate - firstMonday;
  const weekNumber = Math.floor(diff / (1000 * 60 * 60 * 24 * 7)) + 1;
  return {
    year: year,
    weekNumber: weekNumber
  };
};

// Get week number for a given date (backward compatibility)
const getWeekNumberForDate = (date) => {
  return getWeekInfoForDate(date).weekNumber;
};

// get the current week number
const getCurrentWeekNumber = () => {
  const today = normalizeDate(new Date());
  return getWeekNumberForDate(today);
};

// Initialize selected week and year based on prop or current week
const getInitialWeekInfo = () => {
  if (props.initialWeekStartDate) {
    return getWeekInfoForDate(props.initialWeekStartDate);
  }
  const today = normalizeDate(new Date());
  return getWeekInfoForDate(today);
};

// Initialize selected week based on prop or current week
const getInitialWeekNumber = () => {
  return getInitialWeekInfo().weekNumber;
};

// Initialize year based on prop or current year
const getInitialYear = () => {
  return getInitialWeekInfo().year;
};

const selectedYear = ref(getInitialYear());
const selectedWeek = ref(getInitialWeekNumber());
const weeks = ref([]);

// Filter weeks to only show 3 weeks before and after the selected week
// This ensures that when viewing a future date, weeks around that date are shown
const filteredWeeks = computed(() => {
  if (weeks.value.length === 0) return [];
  const referenceWeek = selectedWeek.value;
  const filtered = weeks.value.filter(week => {
    const weekDiff = Math.abs(week.number - referenceWeek);
    return weekDiff <= 3;
  });
  // Ensure the selected week is always in the list, even if it's outside the 3-week range
  if (filtered.length === 0 || !filtered.some(w => w.number === referenceWeek)) {
    const selectedWeekData = weeks.value.find(w => w.number === referenceWeek);
    if (selectedWeekData) {
      return [selectedWeekData];
    }
  }
  return filtered;
});

// Navigation controls
const canGoBack = computed(() => {
  if (filteredWeeks.value.length === 0) return false;
  return selectedWeek.value > Math.min(...filteredWeeks.value.map(w => w.number));
});

const canGoForward = computed(() => {
  if (filteredWeeks.value.length === 0) return false;
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
    // Try to use the initial week if provided
    if (props.initialWeekStartDate) {
      const initialWeekInfo = getWeekInfoForDate(props.initialWeekStartDate);
      // Only use initial week if it's for the current year
      if (initialWeekInfo.year === year && weeks.value.some(w => w.number === initialWeekInfo.weekNumber)) {
        selectedWeek.value = initialWeekInfo.weekNumber;
      } else {
        // If initial week is for a different year, we'll handle it in the watch
        // For now, default to the last week of the year
        selectedWeek.value = weeks.value[weeks.value.length - 1].number;
      }
    } else {
      // Otherwise use current week
      const currentWeek = getCurrentWeekNumber();
      if (weeks.value.some(w => w.number === currentWeek)) {
        selectedWeek.value = currentWeek;
      } else {
        // If current week doesn't exist, default to the last week of the year
        selectedWeek.value = weeks.value[weeks.value.length - 1].number;
      }
    }
  }
};

// Update year and week when initialWeekStartDate changes
watch(() => props.initialWeekStartDate, (newDate) => {
  if (newDate) {
    const weekInfo = getWeekInfoForDate(newDate);
    if (weekInfo.year !== selectedYear.value) {
      selectedYear.value = weekInfo.year;
    }
    // The week will be set after updateWeeks runs (via watchEffect)
    // We'll set it here as well to ensure it's set correctly
    if (weeks.value.length > 0 && weeks.value.some(w => w.number === weekInfo.weekNumber)) {
      selectedWeek.value = weekInfo.weekNumber;
    }
  }
}, { immediate: true });

// Also watch for when weeks are updated to set the correct week from initial date
watch(weeks, () => {
  if (props.initialWeekStartDate && weeks.value.length > 0) {
    const weekInfo = getWeekInfoForDate(props.initialWeekStartDate);
    if (weekInfo.year === selectedYear.value && weeks.value.some(w => w.number === weekInfo.weekNumber)) {
      selectedWeek.value = weekInfo.weekNumber;
    }
  }
}, { immediate: true });

watchEffect(() => {
  updateWeeks();
});

// Emit the selected week's start date when it changes
const emit = defineEmits(['weekChange']);

watch(selectedWeek, () => {
  if (weeks.value.length > 0 && weeks.value.some(w => w.number === selectedWeek.value)) {
    const weekStartDate = normalizeDate(getFirstDayOfWeek(selectedYear.value, selectedWeek.value));
    emit('weekChange', weekStartDate);
  }
}, { immediate: false });
</script>