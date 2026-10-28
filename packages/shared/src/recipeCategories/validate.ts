import { getMealSlotNameError, normalizeMealSlotName } from '../mealSlots/validate.ts';

export type RecipeCategoryNameErrorCode =
  | 'empty'
  | 'too_long'
  | 'emoji'
  | 'control_chars'
  | 'duplicate';

export const normalizeRecipeCategoryName = (name: string): string =>
  normalizeMealSlotName(name);

/** Format checks shared with meal slots. Duplicate is checked against the names passed in. */
export const getRecipeCategoryNameError = (
  name: string
): Exclude<RecipeCategoryNameErrorCode, 'duplicate'> | null => {
  const error = getMealSlotNameError(name);
  if (error == null || error === 'duplicate') {
    return null;
  }
  return error;
};

export const recipeCategoryNameError = (
  name: string,
  existingNames: readonly string[]
): RecipeCategoryNameErrorCode | null => {
  const formatError = getRecipeCategoryNameError(name);
  if (formatError) {
    return formatError;
  }

  const key = normalizeRecipeCategoryName(name).toLowerCase();
  const duplicate = existingNames.some(
    (existing) => normalizeRecipeCategoryName(existing).toLowerCase() === key
  );
  return duplicate ? 'duplicate' : null;
};
