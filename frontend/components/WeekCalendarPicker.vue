<template>
  <div class="p-4">
    <div class="flex flex-col md:flex-row gap-4">
      <div class="form-control w-full max-w-lg mx-auto text-center">
        <label class="label">
          <span class="label-text">{{ $t('Week Selection') }}</span>
        </label>
        <button
          v-if="!isCurrentWeek"
          type="button"
          class="btn btn-ghost btn-sm mb-2"
          data-testid="week-this-week-button"
          @click="emit('goToThisWeek')"
        >
          {{ $t('This week') }}
        </button>
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
import { useWeekCalendar } from '~/composables/useWeekCalendar';

const props = defineProps({
  initialWeekStartDate: {
    type: Date,
    default: null
  },
  isCurrentWeek: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['weekChange', 'goToThisWeek']);

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
} = useWeekCalendar(initialWeekStartDateRef);

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