import { describe, expect, it } from 'vitest';
import {
  mergeRecipePendingEdit,
  parseRecipeSyncValue,
  recipeSyncValuesMatch,
  toRecipeSyncValue,
} from '../sync.ts';

const soup = toRecipeSyncValue({
  name: ' Soup ',
  description: ' ',
  instructions: 'Simmer',
  portions: 2,
  ingredients: [
    { name: ' Onion ', quantity: '1', unit: '' },
    { name: '  ', quantity: 1, unit: 'g' },
  ],
  category_ids: [4, 2, 4],
});

describe('recipe sync values', () => {
  it('normalizes text, drops blank ingredients, and sorts category ids', () => {
    expect(soup).toEqual({
      name: 'Soup',
      description: null,
      instructions: 'Simmer',
      portions: 2,
      ingredients: [{ name: 'Onion', quantity: 1, unit: null }],
      category_ids: [2, 4],
    });
    expect(parseRecipeSyncValue({ name: '  ' })).toBeNull();
    expect(parseRecipeSyncValue(null)).toBeNull();
  });

  it('matches the same recipe even when category order differs', () => {
    const reordered = toRecipeSyncValue({
      name: 'Soup',
      instructions: 'Simmer',
      portions: 2,
      ingredients: [{ name: 'Onion', quantity: 1, unit: null }],
      categories: [{ id: 4 }, { id: 2 }],
    });
    expect(recipeSyncValuesMatch(soup, reordered)).toBe(true);
    expect(recipeSyncValuesMatch(soup, { ...soup, name: 'Stew' })).toBe(false);
  });

  it('keeps the first baseline and drops an edit that returns to it', () => {
    const queued = mergeRecipePendingEdit([], {
      recipeId: 8,
      baseline: soup,
      recipe: { ...soup, name: 'Stew' },
    });
    const replaced = mergeRecipePendingEdit(queued, {
      recipeId: 8,
      baseline: { ...soup, name: 'Ignored' },
      recipe: { ...soup, name: 'Chowder' },
    });
    expect(replaced).toEqual([
      { recipeId: 8, baseline: soup, recipe: { ...soup, name: 'Chowder' } },
    ]);
    expect(mergeRecipePendingEdit(replaced, {
      recipeId: 8,
      baseline: soup,
      recipe: soup,
    })).toEqual([]);
  });
});
