import { format, isSameDay, startOfISOWeek, type Locale } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { parseWeekStartDisplayDate } from '~/composables/mealDiaryWeekKey';

interface DateUtils {
  getDayName: (dayNumber: number, weekStartDate?: string | null) => string;
  getDateForDay: (weekStartDate: string | null, dayNumber: number) => string;
  isDayInPast: (weekStartDate: string | null, dayNumber: number) => boolean;
}

const dateFnsLocales: Record<string, Locale> = {
  en: enUS,
};

function resolveDateFnsLocale(i18nLocale: string): Locale {
  return dateFnsLocales[i18nLocale] ?? enUS;
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

export const useDateUtils = (): DateUtils => {
  const { locale } = useI18n();
  const dateFnsLocale = computed(() => resolveDateFnsLocale(locale.value));

  const getDayName = (dayNumber: number, weekStartDate?: string | null): string => {
    if (weekStartDate) {
      const date = dayDateFromWeekStart(weekStartDate, dayNumber);
      if (date) {
        return format(date, 'EEEE', { locale: dateFnsLocale.value });
      }
    }
    const referenceMonday = startOfISOWeek(new Date());
    referenceMonday.setHours(0, 0, 0, 0);
    const date = new Date(referenceMonday);
    date.setDate(referenceMonday.getDate() + (dayNumber - 1));
    return format(date, 'EEEE', { locale: dateFnsLocale.value });
  };

  const getDateForDay = (weekStartDate: string | null, dayNumber: number): string => {
    if (!weekStartDate) return '';

    try {
      const date = dayDateFromWeekStart(weekStartDate, dayNumber);
      if (!date) return '';

      return format(date, 'd MMM', { locale: dateFnsLocale.value });
    } catch (error) {
      console.error('Error calculating date:', error);
      return '';
    }
  };

  const isDayInPast = (weekStartDate: string | null, dayNumber: number): boolean => {
    if (!weekStartDate) return false;

    try {
      const startDate = parseWeekStartDisplayDate(weekStartDate);
      if (isNaN(startDate.getTime())) return false;

      const today: Date = new Date();
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
    } catch (error) {
      console.error('Error checking if day is in past:', error);
      return false;
    }
  };

  return {
    getDayName,
    getDateForDay,
    isDayInPast,
  };
};
