import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import {
  getFirstDayOfWeek,
  getLastWeekNumberOfYear,
  getWeekInfoForDate,
  normalizeDate,
  useWeekCalendar,
} from './useWeekCalendar';

describe('useWeekCalendar', () => {
  it('normalizes dates onto ISO weeks', () => {
    const normalized = normalizeDate(new Date(2026, 9, 23, 18, 45));
    expect(normalized.getHours()).toBe(0);
    expect(getWeekInfoForDate(new Date(2026, 9, 23))).toEqual({ year: 2026, weekNumber: 43 });
    expect(getFirstDayOfWeek(2026, 43)).toEqual(new Date(2026, 9, 19));
    expect(getLastWeekNumberOfYear(2026)).toBe(53);
  });

  it('moves between weeks and blocks a week the entitlement rejects', () => {
    const onWeekBlocked = vi.fn();
    const calendar = useWeekCalendar(ref(new Date(2026, 9, 19)), ref({
      canSelectWeek: (weekStart: Date) => weekStart.getDate() !== 26,
      onWeekBlocked,
    }));

    expect(calendar.selectedWeekKey.value).toBe('2026-43');
    expect(calendar.getSelectedWeekStartDate()).toEqual(new Date(2026, 9, 19));
    expect(calendar.canGoForward.value).toBe(false);

    calendar.handleNextWeek();
    expect(onWeekBlocked).toHaveBeenCalled();
    expect(calendar.selectedWeek.value).toBe(43);

    calendar.handleWeekSelect(2026, 44);
    expect(calendar.selectedWeek.value).toBe(43);

    expect(calendar.canGoBack.value).toBe(true);
    calendar.handlePreviousWeek();
    expect(calendar.selectedWeek.value).toBe(42);
    expect(calendar.filteredWeeks.value.some((week) => week.number === 42)).toBe(true);
  });
});
