import { format, isValid, parseISO, startOfISOWeek } from 'date-fns';

/**
 * Parses a week boundary for meal diary logic: local calendar day for YYYY-MM-DD,
 * otherwise date-fns parseISO (full timestamps).
 */
function parseMealDiaryWeekInput(input: Date | string): Date {
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return parseISO(s);
}

/**
 * Stable week identifier: ISO week Monday as YYYY-MM-DD (local calendar).
 * Aligns with WeekCalendarPicker / date-fns ISO weeks and avoids UTC day-shift from toISOString().
 */
export function normalizeMealDiaryWeekKey(input: Date | string): string {
  const d = parseMealDiaryWeekInput(input);
  if (!isValid(d)) {
    return '';
  }
  return format(startOfISOWeek(d), 'yyyy-MM-dd');
}

export function weekKeysEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (a == null || b == null) {
    return false;
  }
  return normalizeMealDiaryWeekKey(a) === normalizeMealDiaryWeekKey(b);
}

/** Local midnight calendar date for a normalized week key (for pickers / display). */
export function weekStartKeyToLocalDate(key: string): Date {
  const s = key.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(s);
}

/** Local calendar Date at midnight for diary row math (supports legacy ISO strings). */
export function parseWeekStartDisplayDate(weekStartDate: string): Date {
  const s = weekStartDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, d] = s.split('-').map(Number);
    return new Date(y, mo - 1, d);
  }
  const parsed = new Date(weekStartDate);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}
