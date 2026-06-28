<template>
  <div class="p-4">
    <div class="flex flex-col md:flex-row gap-4">
      <div class="form-control w-full max-w-lg mx-auto text-center">
        <label class="label">
          <span class="label-text">{{ $t('Week Selection') }}</span>
        </label>
        <div
          v-if="!isCurrentWeek"
          class="mb-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 rounded-box border border-primary/20 bg-primary/5 px-4 py-2.5"
        >
          <span class="text-sm text-base-content/70">{{ $t(viewingWeekMessageKey) }}</span>
          <button
            type="button"
            class="btn btn-primary btn-sm gap-1.5 w-full sm:w-auto"
            data-testid="week-this-week-button"
            @click="emit('goToThisWeek')"
          >
            <fa icon="calendar-day" />
            {{ $t('This week') }}
          </button>
        </div>
        <div class="flex flex-row flex-nowrap items-center gap-2 w-full">
          <button
            type="button"
            class="btn btn-primary shrink-0"
            data-testid="week-previous-button"
            @click="handlePreviousWeek"
            :disabled="!canGoBack"
          >
            <fa icon="chevron-left" />
          </button>
          <select
            :value="selectedWeekKey"
            class="select select-bordered min-w-0 flex-1"
            data-testid="week-select"
            @change="handleWeekSelect"
          >
            <option v-for="week in filteredWeeks" :key="`${week.year}-${week.number}`" :value="`${week.year}-${week.number}`">
              {{ $t('Week') }} {{ week.number }}{{ week.year !== selectedYear ? ' ' + week.year : '' }} ({{ week.startDate.toLocaleDateString() }} - {{ week.endDate.toLocaleDateString() }})
            </option>
          </select>
          <button
            type="button"
            class="btn btn-primary shrink-0"
            data-testid="week-next-button"
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
import { computed, watch } from 'vue';
import { startOfISOWeek } from 'date-fns';
import { useWeekCalendar, normalizeDate } from '~/composables/useWeekCalendar';

const props = defineProps({
  initialWeekStartDate: {
    type: Date,
    default: null
  },
  isCurrentWeek: {
    type: Boolean,
    default: false,
  },
  canSelectWeek: {
    type: Function,
    default: null,
  },
});

const emit = defineEmits(['weekChange', 'goToThisWeek', 'weekBlocked']);

const entitlementOptions = computed(() => ({
  canSelectWeek: props.canSelectWeek ?? undefined,
  onWeekBlocked: () => emit('weekBlocked'),
}));

// Use the composable with a ref to the prop
const initialWeekStartDateRef = computed(() => props.initialWeekStartDate);
const {
  selectedYear,
  selectedWeek,
  selectedWeekKey,
  filteredWeeks,
  canGoBack,
  canGoForward,
  handlePreviousWeek,
  handleNextWeek,
  handleWeekSelect: handleWeekSelectInternal,
  getSelectedWeekStartDate,
} = useWeekCalendar(initialWeekStartDateRef, entitlementOptions);

const viewingWeekMessageKey = computed(() => {
  const selectedStart = getSelectedWeekStartDate();
  if (!selectedStart) {
    return 'Viewing another week';
  }

  const currentWeekStart = normalizeDate(startOfISOWeek(new Date()));
  const selectedTime = selectedStart.getTime();
  const currentTime = currentWeekStart.getTime();

  if (selectedTime < currentTime) {
    return 'Viewing a previous week';
  }
  if (selectedTime > currentTime) {
    return 'Viewing a future week';
  }
  return 'Viewing another week';
});

// Handle week selection from dropdown
const handleWeekSelect = (event) => {
  const value = event.target.value;
  const [year, week] = value.split('-').map(Number);
  if (year && week) {
    handleWeekSelectInternal(year, week);
  }
};

// Watch for changes in selected week/year and emit the week change
watch([selectedWeek, selectedYear], () => {
  const weekStartDate = getSelectedWeekStartDate();
  if (weekStartDate) {
    emit('weekChange', weekStartDate);
  }
}, { immediate: false });
</script>