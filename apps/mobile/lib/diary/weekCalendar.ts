import {
  endOfISOWeek,
  getISOWeek,
  getISOWeekYear,
  getISOWeeksInYear,
  setISOWeek,
  setISOWeekYear,
  startOfISOWeek,
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

export interface WeekCalendarEntitlementOptions {
  canSelectWeek?: (weekStart: Date) => boolean;
  onWeekBlocked?: () => void;
}

export function normalizeDate(date: Date | string): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function getFirstDayOfWeek(isoWeekYear: number, week: number): Date {
  const referenceDate = new Date(isoWeekYear, 0, 4);
  let dateWithWeek = setISOWeekYear(referenceDate, isoWeekYear);
  dateWithWeek = setISOWeek(dateWithWeek, week);
  return normalizeDate(startOfISOWeek(dateWithWeek));
}

export function getLastWeekNumberOfYear(isoWeekYear: number): number {
  const referenceDate = new Date(isoWeekYear, 0, 4);
  return getISOWeeksInYear(referenceDate);
}

export function getWeekInfoForDate(date: Date | string): WeekInfo {
  const normalizedDate = normalizeDate(date);
  return {
    year: getISOWeekYear(normalizedDate),
    weekNumber: getISOWeek(normalizedDate),
  };
}

export function generateWeeksForYear(isoWeekYear: number): WeekData[] {
  const weeksList: WeekData[] = [];
  const referenceDate = new Date(isoWeekYear, 0, 4);
  const numWeeks = getISOWeeksInYear(referenceDate);

  for (let i = 1; i <= numWeeks; i++) {
    const weekStartDate = getFirstDayOfWeek(isoWeekYear, i);
    weeksList.push({
      year: isoWeekYear,
      number: i,
      startDate: weekStartDate,
      endDate: normalizeDate(endOfISOWeek(weekStartDate)),
    });
  }

  const previousIsoYear = isoWeekYear - 1;
  const prevYearLastWeek = getLastWeekNumberOfYear(previousIsoYear);
  const prevYearLastWeekStart = getFirstDayOfWeek(previousIsoYear, prevYearLastWeek);
  const hasPrevYearLastWeek = weeksList.some(
    (w) => w.year === previousIsoYear && w.number === prevYearLastWeek
  );

  if (!hasPrevYearLastWeek) {
    weeksList.unshift({
      year: previousIsoYear,
      number: prevYearLastWeek,
      startDate: prevYearLastWeekStart,
      endDate: normalizeDate(endOfISOWeek(prevYearLastWeekStart)),
    });
  }

  const nextIsoYear = isoWeekYear + 1;
  const nextYearFirstWeekStart = getFirstDayOfWeek(nextIsoYear, 1);
  const hasNextYearFirstWeek = weeksList.some((w) => w.year === nextIsoYear && w.number === 1);

  if (!hasNextYearFirstWeek) {
    weeksList.push({
      year: nextIsoYear,
      number: 1,
      startDate: nextYearFirstWeekStart,
      endDate: normalizeDate(endOfISOWeek(nextYearFirstWeekStart)),
    });
  }

  weeksList.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return weeksList;
}

export function getViewingWeekMessageKey(selectedStart: Date | null): string {
  if (!selectedStart) {
    return 'diary.viewingAnotherWeek';
  }

  const currentWeekStart = normalizeDate(startOfISOWeek(new Date()));
  const selectedTime = selectedStart.getTime();
  const currentTime = currentWeekStart.getTime();

  if (selectedTime < currentTime) {
    return 'diary.viewingPreviousWeek';
  }
  if (selectedTime > currentTime) {
    return 'diary.viewingFutureWeek';
  }
  return 'diary.viewingAnotherWeek';
}

export function formatWeekOptionLabel(week: WeekData, selectedYear: number, weekLabel: string): string {
  const yearSuffix = week.year !== selectedYear ? ` ${week.year}` : '';
  const start = week.startDate.toLocaleDateString();
  const end = week.endDate.toLocaleDateString();
  return `${weekLabel} ${week.number}${yearSuffix} (${start} - ${end})`;
}
