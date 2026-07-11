import { format, isSameDay, startOfISOWeek, type Locale } from 'date-fns';
import { enUS } from 'date-fns/locale';

import { parseWeekStartDisplayDate } from '@/lib/diary/mealDiaryWeekKey';

const dateFnsLocales: Record<string, Locale> = {
  en: enUS,
};

function resolveDateFnsLocale(locale: string): Locale {
  return dateFnsLocales[locale] ?? enUS;
}

function dayDateFromWeekStart(weekStartDate: string, dayNumber: number): Date | null {
  const startDate = parseWeekStartDisplayDate(weekStartDate);
  if (isNaN(startDate.getTime())) {
    return null;
  }
  const dayOffset = dayNumber - 1;
  const date = new Date(startDate);
  date.setDate(startDate.getDate() + dayOffset);
  return date;
}

export function getDayName(
  dayNumber: number,
  weekStartDate?: string | null,
  locale = 'en'
): string {
  const dateFnsLocale = resolveDateFnsLocale(locale);

  if (weekStartDate) {
    const date = dayDateFromWeekStart(weekStartDate, dayNumber);
    if (date) {
      return format(date, 'EEEE', { locale: dateFnsLocale });
    }
  }

  const referenceMonday = startOfISOWeek(new Date());
  referenceMonday.setHours(0, 0, 0, 0);
  const date = new Date(referenceMonday);
  date.setDate(referenceMonday.getDate() + (dayNumber - 1));
  return format(date, 'EEEE', { locale: dateFnsLocale });
}

export function getDateForDay(
  weekStartDate: string | null,
  dayNumber: number,
  locale = 'en'
): string {
  if (!weekStartDate) return '';

  try {
    const date = dayDateFromWeekStart(weekStartDate, dayNumber);
    if (!date) return '';

    return format(date, 'd MMM', { locale: resolveDateFnsLocale(locale) });
  } catch {
    return '';
  }
}

export function isDayInPast(weekStartDate: string | null, dayNumber: number): boolean {
  if (!weekStartDate) return false;

  try {
    const startDate = parseWeekStartDisplayDate(weekStartDate);
    if (isNaN(startDate.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentIsoWeekMonday = startOfISOWeek(today);
    currentIsoWeekMonday.setHours(0, 0, 0, 0);

    if (!isSameDay(startDate, currentIsoWeekMonday)) {
      return false;
    }

    const date = dayDateFromWeekStart(weekStartDate, dayNumber);
    if (!date) return false;
    date.setHours(0, 0, 0, 0);

    return date < today;
  } catch {
    return false;
  }
}
