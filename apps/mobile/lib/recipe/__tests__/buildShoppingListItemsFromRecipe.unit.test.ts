import { categorizeShoppingItemName } from '@meal-diary/shared';
import { describe, expect, it } from 'vitest';

import { buildShoppingListItemsFromRecipe } from '@/lib/recipe/buildShoppingListItemsFromRecipe';

describe('buildShoppingListItemsFromRecipe', () => {
  it('formats quantity and unit, then categorizes the formatted name', () => {
    const [withUnit, quantityOnly, nameOnly] = buildShoppingListItemsFromRecipe([
      { name: 'Milk', quantity: 1, unit: 'l' },
      { name: 'Eggs', quantity: 6, unit: null },
      { name: 'Salt' },
    ]);

    expect(withUnit).toEqual({
      name: 'Milk (1 l)',
      category: categorizeShoppingItemName('Milk (1 l)'),
    });
    expect(quantityOnly).toEqual({
      name: 'Eggs (6)',
      category: categorizeShoppingItemName('Eggs (6)'),
    });
    expect(nameOnly).toEqual({
      name: 'Salt',
      category: categorizeShoppingItemName('Salt'),
    });
  });
});
