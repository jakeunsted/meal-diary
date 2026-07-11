const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getCurrentIsoWeekMonday = (referenceDate: Date = new Date()): Date => {
  const date = new Date(referenceDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const normalizeWeekStart = (weekStartDate: Date): Date => {
  const normalized = new Date(weekStartDate);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const isWeekAheadAllowed = (
  weekStartDate: Date,
  maxWeeksAhead: number,
  referenceDate: Date = new Date()
): boolean => {
  if (!Number.isFinite(maxWeeksAhead)) {
    return true;
  }

  const currentMonday = getCurrentIsoWeekMonday(referenceDate);
  const targetMonday = normalizeWeekStart(weekStartDate);
  const diffMs = targetMonday.getTime() - currentMonday.getTime();
  const diffWeeks = Math.round(diffMs / (7 * MS_PER_DAY));

  return diffWeeks <= maxWeeksAhead;
};

export const isPastWeekEditable = (
  weekStartDate: Date,
  canEditPastWeeks: boolean,
  referenceDate: Date = new Date()
): boolean => {
  if (canEditPastWeeks) {
    return true;
  }

  const currentMonday = getCurrentIsoWeekMonday(referenceDate);
  const targetMonday = normalizeWeekStart(weekStartDate);

  return targetMonday.getTime() >= currentMonday.getTime();
};

export const canEditMealWeek = (
  weekStartDate: Date,
  maxWeeksAhead: number,
  canEditPastWeeks: boolean,
  referenceDate: Date = new Date()
): boolean => {
  return (
    isPastWeekEditable(weekStartDate, canEditPastWeeks, referenceDate) &&
    isWeekAheadAllowed(weekStartDate, maxWeeksAhead, referenceDate)
  );
};
