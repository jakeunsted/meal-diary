import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MEAL_SLOT_NAMES,
  MAX_MEAL_SLOT_NAME_LENGTH,
  MAX_MEAL_SLOTS,
  MEAL_SLOT_QUICK_ADD_PRESETS,
  MIN_MEAL_SLOTS,
  diffMealSlots,
  getMealSlotNameError,
  isValidMealSlotCount,
  normalizeMealSlotName,
  validateMealSlotNames,
} from '../index.ts';

describe('presets and defaults', () => {
  it('exposes Breakfast Lunch Dinner as defaults and quick-add presets', () => {
    expect(DEFAULT_MEAL_SLOT_NAMES).toEqual(['Breakfast', 'Lunch', 'Dinner']);
    expect(MEAL_SLOT_QUICK_ADD_PRESETS).toEqual(['Brunch', 'Snack', 'Post-workout']);
    expect(MIN_MEAL_SLOTS).toBe(1);
    expect(MAX_MEAL_SLOTS).toBe(6);
  });
});

describe('normalizeMealSlotName', () => {
  it('trims whitespace', () => {
    expect(normalizeMealSlotName('  Brunch  ')).toBe('Brunch');
  });
});

describe('getMealSlotNameError', () => {
  it('rejects empty, too long, emoji, and control characters', () => {
    expect(getMealSlotNameError('')).toBe('empty');
    expect(getMealSlotNameError('   ')).toBe('empty');
    expect(getMealSlotNameError('a'.repeat(MAX_MEAL_SLOT_NAME_LENGTH + 1))).toBe('too_long');
    expect(getMealSlotNameError('Lunch 🍳')).toBe('emoji');
    expect(getMealSlotNameError('Lunch\u0001')).toBe('control_chars');
    expect(getMealSlotNameError('Brunch')).toBeNull();
  });
});

describe('isValidMealSlotCount', () => {
  it('allows between min and max inclusive', () => {
    expect(isValidMealSlotCount(0)).toBe(false);
    expect(isValidMealSlotCount(1)).toBe(true);
    expect(isValidMealSlotCount(6)).toBe(true);
    expect(isValidMealSlotCount(7)).toBe(false);
  });
});

describe('validateMealSlotNames', () => {
  it('accepts unique valid names', () => {
    const result = validateMealSlotNames([
      { name: 'Breakfast' },
      { name: 'Lunch' },
      { name: 'Dinner' },
    ]);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.names).toEqual(['Breakfast', 'Lunch', 'Dinner']);
  });

  it('flags duplicates case-insensitively', () => {
    const result = validateMealSlotNames([
      { name: 'Brunch' },
      { name: 'brunch' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual({ index: 1, code: 'duplicate' });
  });
});

describe('diffMealSlots', () => {
  it('detects adds, removes, renames, and reorder', () => {
    const current = [
      { id: 1, name: 'Breakfast' },
      { id: 2, name: 'Lunch' },
      { id: 3, name: 'Dinner' },
    ];
    const proposed = [
      { id: 1, name: 'Breakfast' },
      { id: 3, name: 'Supper' },
      { id: null, name: 'Snack' },
    ];
    const diff = diffMealSlots(current, proposed, {
      futureContentBySlotId: { '2': 2 },
    });
    expect(diff.added).toEqual([{ id: null, name: 'Snack' }]);
    expect(diff.removed).toEqual([
      { id: 2, name: 'Lunch', futureMealsWithContent: 2 },
    ]);
    expect(diff.renamed).toEqual([{ id: 3, from: 'Dinner', to: 'Supper' }]);
    expect(diff.requiresConfirmation).toBe(true);
  });

  it('detects reorder when ids are unchanged', () => {
    const current = [
      { id: 1, name: 'Breakfast' },
      { id: 2, name: 'Lunch' },
      { id: 3, name: 'Dinner' },
    ];
    const proposed = [
      { id: 2, name: 'Lunch' },
      { id: 1, name: 'Breakfast' },
      { id: 3, name: 'Dinner' },
    ];
    const diff = diffMealSlots(current, proposed);
    expect(diff.reordered).toBe(true);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it('does not require confirmation when removed slots have no future content', () => {
    const diff = diffMealSlots(
      [
        { id: 1, name: 'Breakfast' },
        { id: 2, name: 'Lunch' },
        { id: 3, name: 'Dinner' },
      ],
      [
        { id: 1, name: 'Breakfast' },
        { id: 3, name: 'Dinner' },
      ],
      { futureContentBySlotId: { '2': 0 } }
    );
    expect(diff.requiresConfirmation).toBe(false);
  });
});
