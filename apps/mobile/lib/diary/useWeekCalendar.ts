import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  generateWeeksForYear,
  getWeekInfoForDate,
  type WeekCalendarEntitlementOptions,
  type WeekData,
} from '@/lib/diary/weekCalendar';

function resolveInitialWeekInfo(initialWeekStartDate: Date | null): { year: number; weekNumber: number } {
  if (initialWeekStartDate) {
    return getWeekInfoForDate(initialWeekStartDate);
  }
  return getWeekInfoForDate(new Date());
}

function findValidWeekSelection(
  weeks: WeekData[],
  year: number,
  week: number,
  initialWeekStartDate: Date | null
): { year: number; week: number } {
  const currentWeekData = weeks.find((w) => w.year === year && w.number === week);
  if (currentWeekData) {
    return { year, week };
  }

  const weekFromAdjacentYear = weeks.find(
    (w) => w.number === week && (w.year === year - 1 || w.year === year + 1)
  );
  if (weekFromAdjacentYear) {
    return { year: weekFromAdjacentYear.year, week: weekFromAdjacentYear.number };
  }

  if (initialWeekStartDate) {
    const initialWeekInfo = getWeekInfoForDate(initialWeekStartDate);
    const initialWeekData = weeks.find(
      (w) => w.year === initialWeekInfo.year && w.number === initialWeekInfo.weekNumber
    );
    if (initialWeekData) {
      return { year: initialWeekInfo.year, week: initialWeekInfo.weekNumber };
    }
  }

  const currentWeekInfo = getWeekInfoForDate(new Date());
  const todayWeekData = weeks.find(
    (w) => w.year === currentWeekInfo.year && w.number === currentWeekInfo.weekNumber
  );
  if (todayWeekData) {
    return { year: currentWeekInfo.year, week: currentWeekInfo.weekNumber };
  }

  const firstWeekOfYear = weeks.find((w) => w.year === year && w.number === 1);
  if (firstWeekOfYear) {
    return { year, week: 1 };
  }

  const anyWeekOfYear = weeks.find((w) => w.year === year);
  if (anyWeekOfYear) {
    return { year, week: anyWeekOfYear.number };
  }

  return { year, week };
}

export function useWeekCalendar(
  initialWeekStartDate: Date | null,
  entitlementOptions?: WeekCalendarEntitlementOptions
) {
  const initialWeekInfo = resolveInitialWeekInfo(initialWeekStartDate);
  const [selectedYear, setSelectedYear] = useState(initialWeekInfo.year);
  const [selectedWeek, setSelectedWeek] = useState(initialWeekInfo.weekNumber);

  const weeks = useMemo(() => generateWeeksForYear(selectedYear), [selectedYear]);

  useEffect(() => {
    const next = findValidWeekSelection(weeks, selectedYear, selectedWeek, initialWeekStartDate);
    if (next.year !== selectedYear || next.week !== selectedWeek) {
      setSelectedYear(next.year);
      setSelectedWeek(next.week);
    }
  }, [weeks, selectedYear, selectedWeek, initialWeekStartDate]);

  const selectedWeekKey = `${selectedYear}-${selectedWeek}`;

  const isWeekSelectable = useCallback(
    (weekStart: Date): boolean => {
      if (!entitlementOptions?.canSelectWeek) {
        return true;
      }
      return entitlementOptions.canSelectWeek(weekStart);
    },
    [entitlementOptions]
  );

  const getSelectedWeekStartDate = useCallback((): Date | null => {
    const weekData = weeks.find((w) => w.year === selectedYear && w.number === selectedWeek);
    return weekData ? weekData.startDate : null;
  }, [weeks, selectedYear, selectedWeek]);

  const getNextWeek = useCallback((): WeekData | null => {
    const currentWeekData = weeks.find((w) => w.year === selectedYear && w.number === selectedWeek);
    if (!currentWeekData) {
      return null;
    }

    return (
      weeks
        .filter((w) => w.startDate.getTime() > currentWeekData.startDate.getTime())
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] ?? null
    );
  }, [weeks, selectedYear, selectedWeek]);

  const filteredWeeks = useMemo(() => {
    if (weeks.length === 0) return [];

    const selectedWeekData = weeks.find((w) => w.year === selectedYear && w.number === selectedWeek);
    if (!selectedWeekData) return weeks;

    const selectedStartDate = selectedWeekData.startDate;
    const filtered = weeks.filter((week) => {
      const daysDiff = Math.abs(
        (week.startDate.getTime() - selectedStartDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysDiff <= 21 && isWeekSelectable(week.startDate);
    });

    const seen = new Map<string, WeekData>();
    const deduplicated: WeekData[] = [];

    for (const week of filtered) {
      const dateKey = `${week.startDate.getTime()}-${week.endDate.getTime()}`;
      if (!seen.has(dateKey)) {
        seen.set(dateKey, week);
        deduplicated.push(week);
      } else {
        const existing = seen.get(dateKey)!;
        if (week.year === selectedYear && existing.year !== selectedYear) {
          const index = deduplicated.indexOf(existing);
          if (index !== -1) {
            deduplicated[index] = week;
            seen.set(dateKey, week);
          }
        }
      }
    }

    if (!deduplicated.some((w) => w.year === selectedYear && w.number === selectedWeek)) {
      return [selectedWeekData];
    }

    return deduplicated;
  }, [weeks, selectedYear, selectedWeek, isWeekSelectable]);

  const findPreviousWeek = useCallback((): WeekData | null => {
    const currentWeekData = weeks.find((w) => w.year === selectedYear && w.number === selectedWeek);
    let currentStartDate: Date | null = currentWeekData?.startDate ?? getSelectedWeekStartDate();
    if (!currentStartDate) {
      return null;
    }

    let allPreviousWeeks = weeks.filter((w) => w.startDate.getTime() < currentStartDate!.getTime());

    if (allPreviousWeeks.length === 0) {
      const sameDateWeek = weeks.find(
        (w) =>
          w.startDate.getTime() === currentStartDate!.getTime() && w.year !== selectedYear
      );

      if (sameDateWeek) {
        const previousWeekInSameYear = weeks.find(
          (w) => w.year === sameDateWeek.year && w.number === sameDateWeek.number - 1
        );

        if (previousWeekInSameYear) {
          allPreviousWeeks = [previousWeekInSameYear];
        } else {
          const targetDate = new Date(currentStartDate);
          targetDate.setDate(targetDate.getDate() - 7);
          allPreviousWeeks = weeks.filter((w) => w.startDate.getTime() <= targetDate.getTime());
        }
      }
    }

    return (
      allPreviousWeeks.sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0] ?? null
    );
  }, [weeks, selectedYear, selectedWeek, getSelectedWeekStartDate]);

  const canGoBack = useMemo(() => !!findPreviousWeek(), [findPreviousWeek]);

  const canGoForward = useMemo(() => {
    const nextWeek = getNextWeek();
    return nextWeek ? isWeekSelectable(nextWeek.startDate) : false;
  }, [getNextWeek, isWeekSelectable]);

  const applyWeekSelection = useCallback((year: number, week: number) => {
    setSelectedYear(year);
    setSelectedWeek(week);
  }, []);

  const handlePreviousWeek = useCallback((): Date | null => {
    const previousWeek = findPreviousWeek();
    if (!previousWeek) {
      return null;
    }

    applyWeekSelection(previousWeek.year, previousWeek.number);
    return previousWeek.startDate;
  }, [findPreviousWeek, applyWeekSelection]);

  const handleNextWeek = useCallback((): Date | 'blocked' | null => {
    const nextWeek = getNextWeek();
    if (!nextWeek) {
      return null;
    }

    if (!isWeekSelectable(nextWeek.startDate)) {
      return 'blocked';
    }

    applyWeekSelection(nextWeek.year, nextWeek.number);
    return nextWeek.startDate;
  }, [getNextWeek, isWeekSelectable, applyWeekSelection]);

  const handleWeekSelect = useCallback(
    (year: number, week: number): Date | 'blocked' | null => {
      const weekData = weeks.find((w) => w.year === year && w.number === week);
      if (!weekData) {
        return null;
      }

      if (!isWeekSelectable(weekData.startDate)) {
        return 'blocked';
      }

      applyWeekSelection(year, week);
      return weekData.startDate;
    },
    [weeks, isWeekSelectable, applyWeekSelection]
  );

  return {
    selectedYear,
    selectedWeek,
    selectedWeekKey,
    filteredWeeks,
    canGoBack,
    canGoForward,
    handlePreviousWeek,
    handleNextWeek,
    handleWeekSelect,
    getSelectedWeekStartDate,
  };
}
