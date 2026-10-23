import { addDays, format, startOfISOWeek } from 'date-fns';
import { describe, expect, it } from 'vitest';

import {
  formatWeekOptionLabel,
  generateWeeksForYear,
  getFirstDayOfWeek,
  getViewingWeekMessageKey,
  getWeekInfoForDate,
} from '@/lib/diary/weekCalendar';

describe('week calendar', () => {
  it('maps a date to its ISO week and that week’s Monday', () => {
    const friday = new Date(2026, 9, 23);
    const info = getWeekInfoForDate(friday);

    expect(info).toEqual({ year: 2026, weekNumber: 43 });
    expect(getFirstDayOfWeek(info.year, info.weekNumber)).toEqual(new Date(2026, 9, 19));
  });

  it('builds a year of weeks bounded by the neighbouring year', () => {
    const weeks = generateWeeksForYear(2026);
    const mondays = weeks.every((week) => week.startDate.getDay() === 1);

    expect(mondays).toBe(true);
    expect(weeks.some((week) => week.year === 2026 && week.number === 1)).toBe(true);
    expect(weeks[0].startDate.getTime()).toBeLessThan(weeks[weeks.length - 1].startDate.getTime());
  });

  it('labels the viewed week relative to the current Monday', () => {
    const currentMonday = startOfISOWeek(new Date());

    expect(getViewingWeekMessageKey(null)).toBe('diary.viewingAnotherWeek');
    expect(getViewingWeekMessageKey(currentMonday)).toBe('diary.viewingAnotherWeek');
    expect(getViewingWeekMessageKey(addDays(currentMonday, -7))).toBe('diary.viewingPreviousWeek');
    expect(getViewingWeekMessageKey(addDays(currentMonday, 7))).toBe('diary.viewingFutureWeek');
  });

  it('includes the year when the week is outside the selected year', () => {
    const week = {
      year: 2025,
      number: 52,
      startDate: new Date(2025, 11, 22),
      endDate: new Date(2025, 11, 28),
    };

    expect(formatWeekOptionLabel(week, 2026, 'Week')).toContain('Week 52 2025');
    expect(formatWeekOptionLabel({ ...week, year: 2026 }, 2026, 'Week')).toContain('Week 52 (');
  });
});

describe('week calendar dates stay local', () => {
  it('formats the Monday used by the ISO week helper', () => {
    expect(format(getFirstDayOfWeek(2026, 43), 'yyyy-MM-dd')).toBe('2026-10-19');
  });
});
