export const SHOPPING_CATEGORIES = ['meat', 'fruit_veg', 'bakery', 'canned', 'other'] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export const DEFAULT_SHOPPING_CATEGORY: ShoppingCategory = 'other';

/** Tab keys including the All view (UI-only, not stored on items). */
export type ShoppingListTab = 'all' | ShoppingCategory;

export const SHOPPING_LIST_TABS: ShoppingListTab[] = ['all', ...SHOPPING_CATEGORIES];

/** i18n key suffixes for category labels (apps supply the translations). */
export const SHOPPING_CATEGORY_LABEL_KEYS: Record<ShoppingCategory, string> = {
  meat: 'meat',
  fruit_veg: 'fruitVeg',
  bakery: 'bakery',
  canned: 'canned',
  other: 'other',
};

export function isShoppingCategory(value: unknown): value is ShoppingCategory {
  return typeof value === 'string' && (SHOPPING_CATEGORIES as readonly string[]).includes(value);
}

export function isShoppingListTab(value: unknown): value is ShoppingListTab {
  return value === 'all' || isShoppingCategory(value);
}
