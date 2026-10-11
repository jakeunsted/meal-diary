export {
  DEFAULT_LEGACY_MEAL_KEYS,
  DEFAULT_MEAL_SLOT_NAMES,
  MAX_MEAL_SLOT_NAME_LENGTH,
  MAX_MEAL_SLOTS,
  MEAL_SLOT_QUICK_ADD_PRESETS,
  MIN_MEAL_SLOTS,
  isLegacyMealKey,
} from './constants.ts';
export type {
  LegacyMealKey,
  MealSlotQuickAddPreset,
} from './constants.ts';

export { diffMealSlots } from './diff.ts';
export type { DiffMealSlotsOptions } from './diff.ts';

export {
  getMealSlotNameError,
  isValidMealSlotCount,
  normalizeMealSlotName,
  validateMealSlotNames,
} from './validate.ts';

export type {
  MealSlotInput,
  MealSlotLike,
  MealSlotNameError,
  MealSlotsDiff,
  MealSlotsValidationResult,
  RemovedSlotImpact,
} from './types.ts';
