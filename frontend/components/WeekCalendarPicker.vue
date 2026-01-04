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
            :value="selectedWeekKey"
            class="select select-bordered"
            @change="handleWeekSelect"
          >
            <option v-for="week in filteredWeeks" :key="`${week.year}-${week.number}`" :value="`${week.year}-${week.number}`">
              {{ $t('Week') }} {{ week.number }}{{ week.year !== selectedYear ? ' ' + week.year : '' }} ({{ week.startDate.toLocaleDateString() }} - {{ week.endDate.toLocaleDateString() }})
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
import { computed, watch } from 'vue';
import { useWeekCalendar } from '~/composables/useWeekCalendar';

const props = defineProps({
  initialWeekStartDate: {
    type: Date,
    default: null
  }
});

const emit = defineEmits(['weekChange']);

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