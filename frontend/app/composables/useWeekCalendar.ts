import { ref, computed, watch, watchEffect, nextTick, type Ref, type ComputedRef } from 'vue';
import { 
  getISOWeek, 
  getISOWeekYear, 
  startOfISOWeek, 
  endOfISOWeek, 
  getISOWeeksInYear,
  setISOWeek,
  setISOWeekYear
} from 'date-fns';

export interface WeekInfo {
  year: number;
  weekNumber: number;
}

export interface WeekData {
  year: number;
  number: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Normalizes a date by setting time to midnight
 */
export const normalizeDate = (date: Date | string): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

/**
 * Calculates the start date (Monday) of a given ISO week and year
 */
export const getFirstDayOfWeek = (isoWeekYear: number, week: number): Date => {
  // Use January 4th as a reference point (always in week 1 of its ISO year)
  const referenceDate = new Date(isoWeekYear, 0, 4);
  // Set to the desired ISO week year and week number
  let dateWithWeek = setISOWeekYear(referenceDate, isoWeekYear);
  dateWithWeek = setISOWeek(dateWithWeek, week);
  // Get the start of that ISO week (Monday)
  return normalizeDate(startOfISOWeek(dateWithWeek));
};

/**
 * Gets the last week number of an ISO week year
 */
export const getLastWeekNumberOfYear = (isoWeekYear: number): number => {
  // Use January 4th as reference (always in week 1 of its ISO year)
  const referenceDate = new Date(isoWeekYear, 0, 4);
  return getISOWeeksInYear(referenceDate);
};

/**
 * Get ISO week number and ISO week year for a given date
 * Returns { year, weekNumber } using ISO 8601 week numbering
 */
export const getWeekInfoForDate = (date: Date | string): WeekInfo => {
  const normalizedDate = normalizeDate(date);
  const isoWeekYear = getISOWeekYear(normalizedDate);
  const weekNumber = getISOWeek(normalizedDate);
  
  return {
    year: isoWeekYear,
    weekNumber: weekNumber
  };
};

/**
 * Composable for managing week calendar state and logic
 */
export const useWeekCalendar = (initialWeekStartDate?: Ref<Date | null> | ComputedRef<Date | null> | null) => {
  // Get initial week info
  const getInitialWeekInfo = (): WeekInfo => {
    if (initialWeekStartDate && 'value' in initialWeekStartDate && initialWeekStartDate.value) {
      return getWeekInfoForDate(initialWeekStartDate.value);
    }
    const today = normalizeDate(new Date());
    return getWeekInfoForDate(today);
  };

  const initialWeekInfo = getInitialWeekInfo();
  const selectedYear = ref(initialWeekInfo.year);
  const selectedWeek = ref(initialWeekInfo.weekNumber);
  const weeks = ref<WeekData[]>([]);

  /**
   * Generates weeks for a given ISO week year, including adjacent weeks from previous/next ISO year
   * All weeks are always 7 days (Monday to Sunday) per ISO 8601
   */
  const generateWeeksForYear = (isoWeekYear: number): WeekData[] => {
    const weeksList: WeekData[] = [];

    // Get number of weeks in the ISO week year
    const referenceDate = new Date(isoWeekYear, 0, 4); // Jan 4 is always in week 1 of its ISO year
    const numWeeks = getISOWeeksInYear(referenceDate);

    // Generate all weeks for this ISO week year
    for (let i = 1; i <= numWeeks; i++) {
      const weekStartDate = getFirstDayOfWeek(isoWeekYear, i);
      const weekEndDate = normalizeDate(endOfISOWeek(weekStartDate));
      
      weeksList.push({
        year: isoWeekYear,
        number: i,
        startDate: weekStartDate,
        endDate: weekEndDate,
      });
    }

    // Always add the last week of the previous ISO year for navigation
    const previousIsoYear = isoWeekYear - 1;
    const prevYearLastWeek = getLastWeekNumberOfYear(previousIsoYear);
    const prevYearLastWeekStart = getFirstDayOfWeek(previousIsoYear, prevYearLastWeek);
    const prevYearLastWeekEnd = normalizeDate(endOfISOWeek(prevYearLastWeekStart));
    
    // Check if we already have this week
    const hasPrevYearLastWeek = weeksList.some(w => 
      w.year === previousIsoYear && w.number === prevYearLastWeek
    );
    
    if (!hasPrevYearLastWeek) {
      weeksList.unshift({
        year: previousIsoYear,
        number: prevYearLastWeek,
        startDate: prevYearLastWeekStart,
        endDate: prevYearLastWeekEnd,
      });
    }

    // Always add the first week of the next ISO year for navigation
    const nextIsoYear = isoWeekYear + 1;
    const nextYearFirstWeekStart = getFirstDayOfWeek(nextIsoYear, 1);
    const nextYearFirstWeekEnd = normalizeDate(endOfISOWeek(nextYearFirstWeekStart));
    
    // Check if we already have this week
    const hasNextYearFirstWeek = weeksList.some(w => 
      w.year === nextIsoYear && w.number === 1
    );
    
    if (!hasNextYearFirstWeek) {
      weeksList.push({
        year: nextIsoYear,
        number: 1,
        startDate: nextYearFirstWeekStart,
        endDate: nextYearFirstWeekEnd,
      });
    }

    // Sort weeks by start date
    weeksList.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    return weeksList;
  };

  /**
   * Updates the weeks list based on the selected year
   */
  const updateWeeks = () => {
    const year = selectedYear.value;
    const currentWeek = selectedWeek.value;
    
    weeks.value = generateWeeksForYear(year);

    // Check if the current selected week exists in the weeks array
    // It might be from an adjacent year (previous/next year's week)
    const currentWeekData = weeks.value.find(w => w.year === year && w.number === currentWeek);
    
    if (!currentWeekData) {
      // The selected week might be from an adjacent year that's included in the weeks array
      // Check if there's a week with the same number from adjacent years
      const weekFromAdjacentYear = weeks.value.find(w => w.number === currentWeek && 
        (w.year === year - 1 || w.year === year + 1));
      
      if (weekFromAdjacentYear) {
        // If we found it from an adjacent year, that's fine - it's in the array
        // The week is already in the array, so navigation will work
        return;
      }
      
      // Try to use the initial week if provided
      if (initialWeekStartDate && 'value' in initialWeekStartDate && initialWeekStartDate.value) {
        const initialWeekInfo = getWeekInfoForDate(initialWeekStartDate.value);
        const initialWeekData = weeks.value.find(w => w.year === initialWeekInfo.year && w.number === initialWeekInfo.weekNumber);
        if (initialWeekData) {
          if (initialWeekInfo.year !== year) {
            selectedYear.value = initialWeekInfo.year;
          } else {
            selectedWeek.value = initialWeekInfo.weekNumber;
          }
          return;
        }
      }
      
      // Otherwise use current week
      const today = normalizeDate(new Date());
      const currentWeekInfo = getWeekInfoForDate(today);
      const currentWeekData2 = weeks.value.find(w => w.year === currentWeekInfo.year && w.number === currentWeekInfo.weekNumber);
      if (currentWeekData2) {
        if (currentWeekInfo.year !== year) {
          selectedYear.value = currentWeekInfo.year;
        } else {
          selectedWeek.value = currentWeekInfo.weekNumber;
        }
      } else {
        // Default to the first week of the current year
        const firstWeekOfYear = weeks.value.find(w => w.year === year && w.number === 1);
        if (firstWeekOfYear) {
          selectedWeek.value = 1;
        } else {
          // Fallback to any week from current year
          const anyWeekOfYear = weeks.value.find(w => w.year === year);
          if (anyWeekOfYear) {
            selectedWeek.value = anyWeekOfYear.number;
          }
        }
      }
    }
  };

  // Update weeks when selected year changes
  watchEffect(() => {
    updateWeeks();
  });

  // Watch for changes in initialWeekStartDate
  if (initialWeekStartDate) {
    watch(initialWeekStartDate, (newDate) => {
      if (newDate) {
        const weekInfo = getWeekInfoForDate(newDate);
        if (weekInfo.year !== selectedYear.value) {
          selectedYear.value = weekInfo.year;
        }
        const weekData = weeks.value.find(w => w.year === weekInfo.year && w.number === weekInfo.weekNumber);
        if (weekData) {
          selectedWeek.value = weekInfo.weekNumber;
        }
      }
    }, { immediate: true });

    // Also watch for when weeks are updated to set the correct week from initial date
    watch(weeks, () => {
      if (initialWeekStartDate && 'value' in initialWeekStartDate && initialWeekStartDate.value && weeks.value.length > 0) {
        const weekInfo = getWeekInfoForDate(initialWeekStartDate.value);
        const weekData = weeks.value.find(w => w.year === weekInfo.year && w.number === weekInfo.weekNumber);
        if (weekData) {
          selectedYear.value = weekInfo.year;
          selectedWeek.value = weekInfo.weekNumber;
        }
      }
    }, { immediate: true });
  }

  // Computed property for the select dropdown key
  const selectedWeekKey = computed(() => `${selectedYear.value}-${selectedWeek.value}`);

  // Filter weeks to only show 3 weeks before and after the selected week
  // Also deduplicates weeks with the same date range
  const filteredWeeks = computed(() => {
    if (weeks.value.length === 0) return [];
    const referenceYear = selectedYear.value;
    const referenceWeek = selectedWeek.value;
    
    // Find the selected week's start date to calculate relative positions
    const selectedWeekData = weeks.value.find(w => w.year === referenceYear && w.number === referenceWeek);
    if (!selectedWeekData) return weeks.value;
    
    const selectedStartDate = selectedWeekData.startDate;
    
    // Filter weeks that are within 3 weeks (21 days) of the selected week
    const filtered = weeks.value.filter(week => {
      const weekStartDate = week.startDate;
      const daysDiff = Math.abs((weekStartDate.getTime() - selectedStartDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 21; // 3 weeks = 21 days
    });
    
    // Deduplicate weeks with the same date range
    // Keep the week that matches the selected year if available, otherwise keep the first one
    const seen = new Map<string, WeekData>();
    const deduplicated: WeekData[] = [];
    
    for (const week of filtered) {
      const dateKey = `${week.startDate.getTime()}-${week.endDate.getTime()}`;
      if (!seen.has(dateKey)) {
        seen.set(dateKey, week);
        deduplicated.push(week);
      } else {
        // If we have a duplicate, prefer the one that matches the selected year
        const existing = seen.get(dateKey)!;
        if (week.year === referenceYear && existing.year !== referenceYear) {
          // Replace with the week from the selected year
          const index = deduplicated.indexOf(existing);
          if (index !== -1) {
            deduplicated[index] = week;
            seen.set(dateKey, week);
          }
        }
      }
    }
    
    // Ensure the selected week is always in the list
    if (!deduplicated.some(w => w.year === referenceYear && w.number === referenceWeek)) {
      if (selectedWeekData) {
        return [selectedWeekData];
      }
    }
    
    return deduplicated;
  });

  // Navigation controls
  const canGoBack = computed(() => {
    if (weeks.value.length === 0) return false;
    
    const currentWeekData = weeks.value.find(w => w.year === selectedYear.value && w.number === selectedWeek.value);
    
    if (!currentWeekData) {
      // If current week not found, try to find any week with the same start date
      const currentStartDate = getSelectedWeekStartDate();
      if (!currentStartDate) return false;
      const previousWeek = weeks.value
        .filter(w => w.startDate.getTime() < currentStartDate.getTime())
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
      return !!previousWeek;
    }
    
    const currentStartDate = currentWeekData.startDate;
    
    // First, try to find weeks with start date before current
    let allPreviousWeeks = weeks.value.filter(w => w.startDate.getTime() < currentStartDate.getTime());
    
    // If no previous weeks found, check if there's a week with the same start date from a different year
    // (this happens when the last week of previous year and first week of current year overlap)
    if (allPreviousWeeks.length === 0) {
      const sameDateWeek = weeks.value.find(w => 
        w.startDate.getTime() === currentStartDate.getTime() && 
        w.year !== selectedYear.value
      );
      
      if (sameDateWeek) {
        // Look for the week that's numbered one less in that year (the actual previous week)
        const previousWeekNumber = sameDateWeek.number - 1;
        const previousWeekInSameYear = weeks.value.find(w => 
          w.year === sameDateWeek.year && 
          w.number === previousWeekNumber
        );
        
        if (previousWeekInSameYear) {
          allPreviousWeeks = [previousWeekInSameYear];
        } else {
          // Fallback: look for the week that's 7 days before this date
          const targetDate = new Date(currentStartDate);
          targetDate.setDate(targetDate.getDate() - 7);
          allPreviousWeeks = weeks.value.filter(w => w.startDate.getTime() <= targetDate.getTime());
        }
      }
    }
    
    const previousWeek = allPreviousWeeks
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
    
    return !!previousWeek;
  });

  const canGoForward = computed(() => {
    if (weeks.value.length === 0) return false;
    const currentWeekData = weeks.value.find(w => w.year === selectedYear.value && w.number === selectedWeek.value);
    if (!currentWeekData) return false;
    
    const currentStartDate = currentWeekData.startDate;
    const nextWeek = weeks.value
      .filter(w => w.startDate.getTime() > currentStartDate.getTime())
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
    
    return !!nextWeek;
  });

  // Navigation handlers
  const handlePreviousWeek = () => {
    if (!canGoBack.value) return;
    
    // Get current week's start date
    let currentStartDate: Date;
    const currentWeekData = weeks.value.find(w => w.year === selectedYear.value && w.number === selectedWeek.value);
    if (currentWeekData) {
      currentStartDate = currentWeekData.startDate;
    } else {
      const startDate = getSelectedWeekStartDate();
      if (!startDate) return;
      currentStartDate = startDate;
    }
    
    // Find the previous week - look in all weeks, not just current year
    let allPreviousWeeks = weeks.value.filter(w => w.startDate.getTime() < currentStartDate.getTime());
    
    // If no previous weeks found, check if there's a week with the same start date from a different year
    // (this happens when the last week of previous year and first week of current year overlap)
    if (allPreviousWeeks.length === 0) {
      const sameDateWeek = weeks.value.find(w => 
        w.startDate.getTime() === currentStartDate.getTime() && 
        w.year !== selectedYear.value
      );
      
      if (sameDateWeek) {
        // Look for the week that's numbered one less in that year (the actual previous week)
        const previousWeekNumber = sameDateWeek.number - 1;
        const previousWeekInSameYear = weeks.value.find(w => 
          w.year === sameDateWeek.year && 
          w.number === previousWeekNumber
        );
        
        if (previousWeekInSameYear) {
          allPreviousWeeks = [previousWeekInSameYear];
        } else {
          // Fallback: look for the week that's 7 days before this date
          const targetDate = new Date(currentStartDate);
          targetDate.setDate(targetDate.getDate() - 7);
          allPreviousWeeks = weeks.value.filter(w => w.startDate.getTime() <= targetDate.getTime());
        }
      }
    }
    
    const previousWeek = allPreviousWeeks
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
    
    if (previousWeek) {
      // Store the previous week info before changing year
      const targetYear = previousWeek.year;
      const targetWeek = previousWeek.number;
      
      // If the previous week is from a different year, change year first
      if (targetYear !== selectedYear.value) {
        selectedYear.value = targetYear;
        // Wait for weeks to regenerate, then set the week
        nextTick(() => {
          selectedWeek.value = targetWeek;
        });
      } else {
        // Same year, just update the week
        selectedWeek.value = targetWeek;
      }
    }
  };

  const handleNextWeek = () => {
    if (!canGoForward.value) return;
    
    const currentWeekData = weeks.value.find(w => w.year === selectedYear.value && w.number === selectedWeek.value);
    if (!currentWeekData) return;
    
    const currentStartDate = currentWeekData.startDate;
    const nextWeek = weeks.value
      .filter(w => w.startDate.getTime() > currentStartDate.getTime())
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
    
    if (nextWeek) {
      selectedYear.value = nextWeek.year;
      selectedWeek.value = nextWeek.number;
    }
  };

  const handleWeekSelect = (year: number, week: number) => {
    selectedYear.value = year;
    selectedWeek.value = week;
  };

  // Get the current selected week's start date
  const getSelectedWeekStartDate = (): Date | null => {
    const weekData = weeks.value.find(w => w.year === selectedYear.value && w.number === selectedWeek.value);
    return weekData ? weekData.startDate : null;
  };

  return {
    selectedYear,
    selectedWeek,
    weeks,
    selectedWeekKey,
    filteredWeeks,
    canGoBack,
    canGoForward,
    handlePreviousWeek,
    handleNextWeek,
    handleWeekSelect,
    getSelectedWeekStartDate,
  };
};

