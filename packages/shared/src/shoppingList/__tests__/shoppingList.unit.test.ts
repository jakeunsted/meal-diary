import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SHOPPING_CATEGORY,
  SHOPPING_CATEGORIES,
  isShoppingCategory,
  isShoppingListTab,
} from '../categories.ts';
import {
  categorizeShoppingItemName,
  normalizeShoppingItemName,
} from '../categorize.ts';
import {
  applyCategoryFlatOrder,
  buildShoppingListReorderPayload,
  groupShoppingListItemsByCategory,
  moveShoppingListItemToCategory,
  moveShoppingListItemWithinCategory,
  sortShoppingListItemsForDisplay,
} from '../reorder.ts';
import type { ShoppingListItemLike } from '../types.ts';

describe('categories', () => {
  it('exposes five fixed categories ending with other', () => {
    expect(SHOPPING_CATEGORIES).toEqual([
      'meat',
      'fruit_veg',
      'bakery',
      'canned',
      'other',
    ]);
    expect(DEFAULT_SHOPPING_CATEGORY).toBe('other');
  });

  it('guards category and tab values', () => {
    expect(isShoppingCategory('meat')).toBe(true);
    expect(isShoppingCategory('dairy')).toBe(false);
    expect(isShoppingListTab('all')).toBe(true);
    expect(isShoppingListTab('bakery')).toBe(true);
    expect(isShoppingListTab('unknown')).toBe(false);
  });
});

describe('normalizeShoppingItemName', () => {
  it('strips trailing quantity parentheses from recipe-formatted names', () => {
    expect(normalizeShoppingItemName('Pasta (500 g)')).toBe('pasta');
    expect(normalizeShoppingItemName('  Chicken Breast (2)  ')).toBe('chicken breast');
  });

  it('leaves names without parentheses unchanged', () => {
    expect(normalizeShoppingItemName('Tomatoes')).toBe('tomatoes');
  });
});

describe('categorizeShoppingItemName', () => {
  it('categorizes meat and fish', () => {
    expect(categorizeShoppingItemName('Chicken breast')).toBe('meat');
    expect(categorizeShoppingItemName('minced beef')).toBe('meat');
    expect(categorizeShoppingItemName('Salmon')).toBe('meat');
  });

  it('categorizes fruit and veg', () => {
    expect(categorizeShoppingItemName('Tomatoes')).toBe('fruit_veg');
    expect(categorizeShoppingItemName('Sweet potato')).toBe('fruit_veg');
    expect(categorizeShoppingItemName('Bananas')).toBe('fruit_veg');
  });

  it('categorizes bakery', () => {
    expect(categorizeShoppingItemName('Sourdough')).toBe('bakery');
    expect(categorizeShoppingItemName('Bread rolls')).toBe('bakery');
  });

  it('categorizes canned', () => {
    expect(categorizeShoppingItemName('Tinned tomatoes')).toBe('canned');
    expect(categorizeShoppingItemName('Coconut milk')).toBe('canned');
    expect(categorizeShoppingItemName('Baked beans')).toBe('canned');
  });

  it('falls back to other for unknown items', () => {
    expect(categorizeShoppingItemName('Toothpaste')).toBe('other');
    expect(categorizeShoppingItemName('')).toBe('other');
  });

  it('categorizes recipe-formatted names after stripping parentheses', () => {
    expect(categorizeShoppingItemName('Chicken (500 g)')).toBe('meat');
    expect(categorizeShoppingItemName('Bread (1 loaf)')).toBe('bakery');
  });

  it('prefers longer phrase matches', () => {
    // "tinned tomatoes" is canned, not fruit_veg via "tomatoes"
    expect(categorizeShoppingItemName('Tinned tomatoes')).toBe('canned');
  });
});

function item(
  id: number | string,
  category: ShoppingListItemLike['category'],
  position: number
): ShoppingListItemLike {
  return { id, category, position };
}

describe('sortShoppingListItemsForDisplay', () => {
  it('sorts by category order then position', () => {
    const items = [
      item(1, 'other', 0),
      item(2, 'meat', 1),
      item(3, 'bakery', 0),
      item(4, 'meat', 0),
    ];
    expect(sortShoppingListItemsForDisplay(items).map((i) => i.id)).toEqual([
      4, 2, 3, 1,
    ]);
  });
});

describe('groupShoppingListItemsByCategory', () => {
  it('returns all category buckets including empty ones', () => {
    const groups = groupShoppingListItemsByCategory([
      item(1, 'meat', 0),
      item(2, 'bakery', 0),
    ]);
    expect(groups.meat).toHaveLength(1);
    expect(groups.bakery).toHaveLength(1);
    expect(groups.fruit_veg).toEqual([]);
    expect(groups.canned).toEqual([]);
    expect(groups.other).toEqual([]);
  });
});

describe('moveShoppingListItemWithinCategory', () => {
  it('reorders within a category without touching others', () => {
    const items = [
      item(1, 'meat', 0),
      item(2, 'meat', 1),
      item(3, 'meat', 2),
      item(4, 'bakery', 0),
    ];
    const next = moveShoppingListItemWithinCategory(items, 1, 2);
    expect(
      next
        .filter((i) => i.category === 'meat')
        .sort((a, b) => a.position - b.position)
        .map((i) => i.id)
    ).toEqual([2, 3, 1]);
    expect(next.find((i) => i.id === 4)?.position).toBe(0);
  });

  it('is a no-op for unknown ids', () => {
    const items = [item(1, 'meat', 0)];
    expect(moveShoppingListItemWithinCategory(items, 99, 0)).toBe(items);
  });
});

describe('moveShoppingListItemToCategory', () => {
  it('appends to the target category and reindexes the source', () => {
    const items = [
      item(1, 'meat', 0),
      item(2, 'meat', 1),
      item(3, 'bakery', 0),
    ];
    const next = moveShoppingListItemToCategory(items, 1, 'bakery');
    expect(next.find((i) => i.id === 1)).toMatchObject({
      category: 'bakery',
      position: 1,
    });
    expect(next.find((i) => i.id === 2)).toMatchObject({
      category: 'meat',
      position: 0,
    });
  });

  it('is a no-op when already in the target category', () => {
    const items = [item(1, 'meat', 0)];
    expect(moveShoppingListItemToCategory(items, 1, 'meat')).toBe(items);
  });
});

describe('buildShoppingListReorderPayload', () => {
  it('emits contiguous positions per category', () => {
    const payload = buildShoppingListReorderPayload([
      item(1, 'meat', 5),
      item(2, 'meat', 9),
      item(3, 'other', 2),
    ]);
    expect(payload.filter((c) => c.category === 'meat')).toEqual([
      { id: 1, category: 'meat', position: 0 },
      { id: 2, category: 'meat', position: 1 },
    ]);
    expect(payload.filter((c) => c.category === 'other')).toEqual([
      { id: 3, category: 'other', position: 0 },
    ]);
  });
});

describe('applyCategoryFlatOrder', () => {
  it('applies a new order within one category', () => {
    const items = [
      item(1, 'meat', 0),
      item(2, 'meat', 1),
      item(3, 'bakery', 0),
    ];
    const next = applyCategoryFlatOrder(items, 'meat', [2, 1]);
    expect(next.find((i) => i.id === 2)?.position).toBe(0);
    expect(next.find((i) => i.id === 1)?.position).toBe(1);
    expect(next.find((i) => i.id === 3)?.position).toBe(0);
  });
});
