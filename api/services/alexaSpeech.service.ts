import type { LegacyMealKey } from '@meal-diary/shared';

export const ALEXA_SPEECH = {
  linkAccount: 'Link your Meal Diary account in the Alexa app to hear your diary.',
  unavailable: "Meal Diary on Alexa isn't available.",
  noFamily: 'You need a family in Meal Diary before I can read the diary.',
  familyPlus: 'Meal Diary on Alexa is part of Family Plus.',
  timezone: "I couldn't read this device's time zone, so I can't tell which day to read.",
  launch: "You can ask what's for dinner, or what's in the meal diary today or tomorrow.",
  okay: 'Okay.',
  fallback: "I can read today's or tomorrow's meals. Try what's for dinner.",
} as const;

export type AlexaDiaryDay = 'today' | 'tomorrow';

export interface SpokenSlot {
  name: string;
  position: number;
  legacyKey: LegacyMealKey | null;
  dish: string | null;
  recipeName: string | null;
}

export interface AlexaDiaryDate {
  weekStartDate: string;
  dayOfWeek: number;
  civilDate: string;
}

interface CivilDate {
  year: number;
  month: number;
  day: number;
}

const sanitizeSpeech = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/ {2,}/g, ' ').trim();
};

export const speakFood = (
  dish: string | null | undefined,
  recipeName: string | null | undefined
): string | null => {
  const fromDish = sanitizeSpeech(dish);
  if (fromDish) {
    return fromDish;
  }
  const fromRecipe = sanitizeSpeech(recipeName);
  return fromRecipe || null;
};

export const speakNamedMeal = (
  slotName: string,
  food: string | null,
  day: AlexaDiaryDay
): string => {
  const name = sanitizeSpeech(slotName) || slotName.trim() || 'meal';
  if (day === 'tomorrow') {
    return food
      ? `Tomorrow, ${name} is ${food}.`
      : `Tomorrow, ${name}, nothing planned.`;
  }
  return food ? `${name} is ${food}.` : `${name}, nothing planned.`;
};

export const speakMissingLegacyMeal = (meal: LegacyMealKey): string =>
  `Nothing is planned for ${meal}.`;

export const speakFullDay = (
  familyName: string | null | undefined,
  slots: SpokenSlot[],
  day: AlexaDiaryDay
): string => {
  const family = sanitizeSpeech(familyName) || 'your family';
  const ordered = [...slots].sort((left, right) => left.position - right.position);
  const lines = ordered.map((slot) => {
    const name = sanitizeSpeech(slot.name) || slot.name.trim() || 'meal';
    const food = speakFood(slot.dish, slot.recipeName);
    return food ? `${name}, ${food}.` : `${name}, nothing planned.`;
  });

  if (lines.length === 0 || ordered.every((slot) => !speakFood(slot.dish, slot.recipeName))) {
    return day === 'tomorrow'
      ? 'Nothing is planned in the meal diary tomorrow.'
      : 'Nothing is planned in the meal diary today.';
  }

  const prefix = day === 'tomorrow' ? `Tomorrow in ${family}.` : `Today in ${family}.`;
  return `${prefix} ${lines.join(' ')}`;
};

export const selectLegacySlot = (
  slots: SpokenSlot[],
  meal: LegacyMealKey
): SpokenSlot | null => {
  const ordered = [...slots].sort((left, right) => left.position - right.position);
  return ordered.find((slot) => slot.legacyKey === meal) ?? null;
};

const readPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number => {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) {
    throw new Error('Invalid time zone date');
  }
  return Number(value);
};

export const civilDateInTimeZone = (instant: Date, timeZone: string): CivilDate => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(instant);
  return {
    year: readPart(parts, 'year'),
    month: readPart(parts, 'month'),
    day: readPart(parts, 'day'),
  };
};

export const addCalendarDays = (date: CivilDate, days: number): CivilDate => {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
};

export const diaryDateForCivilDay = (date: CivilDate): AlexaDiaryDate => {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const jsDay = utc.getUTCDay();
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;
  const monday = new Date(utc);
  monday.setUTCDate(monday.getUTCDate() - (dayOfWeek - 1));
  return {
    weekStartDate: monday.toISOString().slice(0, 10),
    dayOfWeek,
    civilDate: utc.toISOString().slice(0, 10),
  };
};

/**
 * Today and tomorrow are the Echo's civil dates in `timeZone`, not the API server's local date.
 * Monday is day_of_week 1 and Sunday is 7, matching calendarDateForDiaryDay.
 */
export const diaryDateForAlexa = (
  timestamp: string,
  timeZone: string,
  day: AlexaDiaryDay
): AlexaDiaryDate => {
  const instant = new Date(timestamp);
  const civil = civilDateInTimeZone(instant, timeZone);
  const target = day === 'tomorrow' ? addCalendarDays(civil, 1) : civil;
  return diaryDateForCivilDay(target);
};
