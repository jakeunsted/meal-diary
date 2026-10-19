import { describe, expect, it } from 'vitest';

import {
  mealDiarySlotValuesMatch,
  normalizeMealDiaryDish,
} from '../../index.ts';

describe('normalizeMealDiaryDish', () => {
  it('trims a dish and treats a blank string as null', () => {
    expect(normalizeMealDiaryDish('  Soup  ')).toBe('Soup');
    expect(normalizeMealDiaryDish('')).toBeNull();
    expect(normalizeMealDiaryDish('   ')).toBeNull();
    expect(normalizeMealDiaryDish(null)).toBeNull();
  });
});

describe('mealDiarySlotValuesMatch', () => {
  it('matches a blank dish with null when the recipe is the same', () => {
    expect(
      mealDiarySlotValuesMatch(
        { dish: '', recipe_id: null },
        { dish: null, recipe_id: null }
      )
    ).toBe(true);
    expect(
      mealDiarySlotValuesMatch(
        { dish: '   ', recipe_id: 4 },
        { dish: null, recipe_id: 4 }
      )
    ).toBe(true);
  });

  it('matches dishes that differ only by surrounding whitespace', () => {
    expect(
      mealDiarySlotValuesMatch(
        { dish: ' Soup ', recipe_id: null },
        { dish: 'Soup', recipe_id: null }
      )
    ).toBe(true);
  });

  it('requires both the normalized dish and the recipe to be equal', () => {
    expect(
      mealDiarySlotValuesMatch(
        { dish: 'Soup', recipe_id: null },
        { dish: 'Stew', recipe_id: null }
      )
    ).toBe(false);
    expect(
      mealDiarySlotValuesMatch(
        { dish: 'Soup', recipe_id: 4 },
        { dish: 'Soup', recipe_id: null }
      )
    ).toBe(false);
    expect(
      mealDiarySlotValuesMatch(
        { dish: 'Soup', recipe_id: 4 },
        { dish: 'Soup', recipe_id: 4 }
      )
    ).toBe(true);
  });
});
