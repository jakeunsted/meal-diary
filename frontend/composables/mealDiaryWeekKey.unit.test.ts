import { describe, expect, it } from 'vitest';
import {
  normalizeMealDiaryWeekKey,
  parseWeekStartDisplayDate,
  weekKeysEqual,
  weekStartKeyToLocalDate,
  weeklyMealsMatchWeek,
} from './mealDiaryWeekKey';

describe('mealDiaryWeekKey', () => {
  it('normalizes a date-only string and a timestamp to the local ISO Monday', () => {
    expect(normalizeMealDiaryWeekKey('2026-10-23')).toBe('2026-10-19');
    expect(normalizeMealDiaryWeekKey(new Date(2026, 9, 23, 15, 30))).toBe('2026-10-19');
    expect(normalizeMealDiaryWeekKey('not-a-date')).toBe('');
  });

  it('compares week keys and checks that every meal belongs to the week', () => {
    expect(weekKeysEqual('2026-10-23', '2026-10-19')).toBe(true);
    expect(weekKeysEqual(null, '2026-10-19')).toBe(false);
    expect(weeklyMealsMatchWeek([], '2026-10-19')).toBe(false);
    expect(weeklyMealsMatchWeek(
      [{ week_start_date: '2026-10-19' }, { week_start_date: '2026-10-23' }],
      '2026-10-19'
    )).toBe(true);
    expect(weeklyMealsMatchWeek(
      [{ week_start_date: '2026-10-12' }],
      '2026-10-19'
    )).toBe(false);
  });

  it('parses a week key back to a local midnight date', () => {
    const date = weekStartKeyToLocalDate('2026-10-19');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(19);

    const parsed = parseWeekStartDisplayDate('2026-10-23T18:00:00');
    expect(parsed.getDate()).toBe(23);
    expect(parsed.getHours()).toBe(0);
  });
});
