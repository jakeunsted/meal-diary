import {
  MAX_MEAL_SLOT_NAME_LENGTH,
  MAX_MEAL_SLOTS,
  MIN_MEAL_SLOTS,
} from './constants.ts';
import type {
  MealSlotInput,
  MealSlotNameError,
  MealSlotsValidationResult,
} from './types.ts';

/** Matches emoji and pictographic symbols (flags, symbols, etc.). */
const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

/** Control characters excluding common whitespace (tab/newline still rejected for names). */
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F-\u009F]/;

export const normalizeMealSlotName = (name: string): string => name.trim();

export const getMealSlotNameError = (name: string): MealSlotNameError | null => {
  const normalized = normalizeMealSlotName(name);
  if (!normalized) {
    return 'empty';
  }
  if (normalized.length > MAX_MEAL_SLOT_NAME_LENGTH) {
    return 'too_long';
  }
  if (EMOJI_REGEX.test(normalized)) {
    return 'emoji';
  }
  if (CONTROL_CHARS_REGEX.test(normalized)) {
    return 'control_chars';
  }
  return null;
};

export const validateMealSlotNames = (
  slots: Array<Pick<MealSlotInput, 'name'>>
): MealSlotsValidationResult => {
  const errors: MealSlotsValidationResult['errors'] = [];
  const names: string[] = [];
  const seen = new Map<string, number>();

  slots.forEach((slot, index) => {
    const normalized = normalizeMealSlotName(slot.name);
    names.push(normalized);

    const nameError = getMealSlotNameError(slot.name);
    if (nameError) {
      errors.push({ index, code: nameError });
      return;
    }

    const key = normalized.toLowerCase();
    const firstIndex = seen.get(key);
    if (firstIndex !== undefined) {
      errors.push({ index, code: 'duplicate' });
    } else {
      seen.set(key, index);
    }
  });

  return {
    ok: errors.length === 0 && isValidMealSlotCount(slots.length),
    names,
    errors,
  };
};

export const isValidMealSlotCount = (count: number): boolean =>
  count >= MIN_MEAL_SLOTS && count <= MAX_MEAL_SLOTS;
