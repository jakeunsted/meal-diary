import { describe, expect, it } from 'vitest';
import { MAX_MEAL_SLOT_NAME_LENGTH } from '../../mealSlots/constants.ts';
import {
  DEFAULT_RECIPE_CATEGORIES,
  MAX_RECIPE_CATEGORY_NAME_LENGTH,
  RECIPE_CATEGORY_STARTER_KEYS,
  countRecipesForCategoryTabs,
  getRecipeCategoryNameError,
  normalizeRecipeCategoryName,
  recipeCategoryNameError,
  recipeMatchesCategoryFilter,
} from '../index.ts';

describe('starter categories', () => {
  it('lists Breakfast, Lunch, Dinner, and Dessert in that order', () => {
    expect(RECIPE_CATEGORY_STARTER_KEYS).toEqual(['breakfast', 'lunch', 'dinner', 'dessert']);
    expect(DEFAULT_RECIPE_CATEGORIES).toEqual([
      { key: 'breakfast', name: 'Breakfast' },
      { key: 'lunch', name: 'Lunch' },
      { key: 'dinner', name: 'Dinner' },
      { key: 'dessert', name: 'Dessert' },
    ]);
    expect(MAX_RECIPE_CATEGORY_NAME_LENGTH).toBe(32);
    expect(MAX_RECIPE_CATEGORY_NAME_LENGTH).toBe(MAX_MEAL_SLOT_NAME_LENGTH);
  });
});

describe('recipe category names', () => {
  it('trims and rejects empty, too long, emoji, and control characters', () => {
    expect(normalizeRecipeCategoryName('  Slow cooker  ')).toBe('Slow cooker');
    expect(getRecipeCategoryNameError('')).toBe('empty');
    expect(getRecipeCategoryNameError('   ')).toBe('empty');
    expect(getRecipeCategoryNameError('a'.repeat(MAX_RECIPE_CATEGORY_NAME_LENGTH + 1))).toBe('too_long');
    expect(getRecipeCategoryNameError('a'.repeat(MAX_RECIPE_CATEGORY_NAME_LENGTH))).toBeNull();
    expect(getRecipeCategoryNameError('Soup 🍲')).toBe('emoji');
    expect(getRecipeCategoryNameError('Soup\u0001')).toBe('control_chars');
    expect(getRecipeCategoryNameError('Slow cooker')).toBeNull();
    expect(recipeCategoryNameError(' dinner ', ['Dinner'])).toBe('duplicate');
    expect(recipeCategoryNameError('Snack', ['Dinner'])).toBeNull();
  });
});

describe('recipeMatchesCategoryFilter', () => {
  const dinner = { categories: [{ id: 3, assignable: true }] };
  const hiddenOnly = { categories: [{ id: 9, assignable: false }] };
  const empty = { categories: [] as { id: number; assignable?: boolean }[] };

  it('matches all, a category id, and only an empty category list as uncategorized', () => {
    expect(recipeMatchesCategoryFilter(dinner, { kind: 'all' })).toBe(true);
    expect(recipeMatchesCategoryFilter(hiddenOnly, { kind: 'all' })).toBe(true);
    expect(recipeMatchesCategoryFilter(empty, { kind: 'all' })).toBe(true);

    expect(recipeMatchesCategoryFilter(dinner, { kind: 'category', categoryId: 3 })).toBe(true);
    expect(recipeMatchesCategoryFilter(dinner, { kind: 'category', categoryId: 1 })).toBe(false);
    expect(recipeMatchesCategoryFilter(hiddenOnly, { kind: 'category', categoryId: 9 })).toBe(true);

    expect(recipeMatchesCategoryFilter(empty, { kind: 'uncategorized' })).toBe(true);
    expect(recipeMatchesCategoryFilter(dinner, { kind: 'uncategorized' })).toBe(false);
    expect(recipeMatchesCategoryFilter(hiddenOnly, { kind: 'uncategorized' })).toBe(false);
  });
});

describe('countRecipesForCategoryTabs', () => {
  it('counts a hidden-custom-only recipe in All and not as Uncategorized or a starter', () => {
    const visible = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
    ];
    const counts = countRecipesForCategoryTabs(
      [
        { categories: [] },
        { categories: [{ id: 3, assignable: true }] },
        { categories: [{ id: 9, assignable: false }] },
      ],
      visible
    );

    expect(counts.all).toBe(3);
    expect(counts.uncategorized).toBe(1);
    expect(counts.byId).toEqual({ 1: 0, 2: 0, 3: 1, 4: 0 });
  });
});
