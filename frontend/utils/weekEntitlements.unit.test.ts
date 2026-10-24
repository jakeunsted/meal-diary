import { describe, expect, it } from 'vitest';
import {
  canEditMealWeek,
  getCurrentIsoWeekMonday,
  isPastWeekEditable,
  isWeekAheadAllowed,
} from './weekEntitlements';

const friday = new Date(2026, 9, 23, 15, 30);

describe('week entitlements', () => {
  it('returns the Monday of the reference week', () => {
    expect(getCurrentIsoWeekMonday(friday)).toEqual(new Date(2026, 9, 19));
  });

  it('allows the current week and a limited number of weeks ahead', () => {
    expect(isWeekAheadAllowed(new Date(2026, 9, 19), 1, friday)).toBe(true);
    expect(isWeekAheadAllowed(new Date(2026, 9, 26), 1, friday)).toBe(true);
    expect(isWeekAheadAllowed(new Date(2026, 10, 2), 1, friday)).toBe(false);
    expect(isWeekAheadAllowed(new Date(2026, 10, 2), Number.POSITIVE_INFINITY, friday)).toBe(true);
  });

  it('blocks past weeks unless editing them is allowed', () => {
    const lastMonday = new Date(2026, 9, 12);
    expect(isPastWeekEditable(lastMonday, false, friday)).toBe(false);
    expect(isPastWeekEditable(lastMonday, true, friday)).toBe(true);
  });

  it('requires both the past-week and weeks-ahead checks', () => {
    expect(canEditMealWeek(new Date(2026, 9, 26), 1, false, friday)).toBe(true);
    expect(canEditMealWeek(new Date(2026, 9, 12), 1, false, friday)).toBe(false);
    expect(canEditMealWeek(new Date(2026, 10, 2), 1, true, friday)).toBe(false);
  });
});
