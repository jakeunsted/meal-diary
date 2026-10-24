import { startOfISOWeek } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { useDateUtils } from './useDateUtils';

describe('useDateUtils', () => {
  const { getDayName, getDateForDay, isDayInPast } = useDateUtils();

  it('names and formats a day inside a known week', () => {
    expect(getDayName(1, '2026-10-19')).toBe('Monday');
    expect(getDateForDay('2026-10-19', 3)).toBe('21 Oct');
    expect(getDateForDay(null, 1)).toBe('');
    expect(getDateForDay('not-a-date', 1)).toBe('');
  });

  it('falls back to the current week when no start date is given', () => {
    const monday = startOfISOWeek(new Date());
    expect(getDayName(1)).toBe('Monday');
    expect(getDayName(monday.getDay() === 0 ? 7 : monday.getDay())).toBeTruthy();
  });

  it('only marks earlier days of the current week as past', () => {
    expect(isDayInPast(null, 1)).toBe(false);
    expect(isDayInPast('2020-01-06', 1)).toBe(false);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monday = startOfISOWeek(today);
    const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    const todayNumber = today.getDay() === 0 ? 7 : today.getDay();
    if (todayNumber > 1) {
      expect(isDayInPast(key, 1)).toBe(true);
    }
    expect(isDayInPast(key, todayNumber)).toBe(false);
  });
});
