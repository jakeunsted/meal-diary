import { format, startOfISOWeek } from 'date-fns';
import { describe, expect, it } from 'vitest';

import { getDateForDay, getDayName, isDayInPast } from '@/lib/diary/dateUtils';

describe('diary date utils', () => {
  it('names and formats a day from the week start', () => {
    expect(getDayName(1, '2026-10-19')).toBe('Monday');
    expect(getDateForDay('2026-10-19', 3)).toBe('21 Oct');
    expect(getDateForDay(null, 1)).toBe('');
  });

  it('treats earlier days in the current week as past', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monday = startOfISOWeek(today);
    const weekKey = format(monday, 'yyyy-MM-dd');
    const isoDay = today.getDay() === 0 ? 7 : today.getDay();

    expect(isDayInPast(null, 1)).toBe(false);
    expect(isDayInPast('2020-01-06', 1)).toBe(false);
    expect(isDayInPast(weekKey, isoDay)).toBe(false);
    if (isoDay > 1) {
      expect(isDayInPast(weekKey, isoDay - 1)).toBe(true);
    }
  });
});
