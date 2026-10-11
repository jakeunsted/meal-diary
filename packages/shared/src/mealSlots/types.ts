import type { LegacyMealKey } from './constants.ts';

export interface MealSlotLike {
  id: number | string;
  name: string;
  position?: number;
  legacy_key?: LegacyMealKey | null;
}

export interface MealSlotInput {
  id?: number | string | null;
  name: string;
}

export interface RemovedSlotImpact {
  id: number | string;
  name: string;
  futureMealsWithContent: number;
}

export interface MealSlotsDiff {
  added: MealSlotInput[];
  removed: RemovedSlotImpact[];
  renamed: Array<{ id: number | string; from: string; to: string }>;
  reordered: boolean;
  requiresConfirmation: boolean;
}

export type MealSlotNameError =
  | 'empty'
  | 'too_long'
  | 'emoji'
  | 'control_chars'
  | 'duplicate';

export interface MealSlotsValidationResult {
  ok: boolean;
  names: string[];
  errors: Array<{ index: number; code: MealSlotNameError }>;
}
