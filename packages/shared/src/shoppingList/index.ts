export {
  DEFAULT_SHOPPING_CATEGORY,
  SHOPPING_CATEGORIES,
  SHOPPING_CATEGORY_LABEL_KEYS,
  SHOPPING_LIST_TABS,
  isShoppingCategory,
  isShoppingListTab,
} from './categories.ts';
export type { ShoppingCategory, ShoppingListTab } from './categories.ts';

export {
  categorizeShoppingItemName,
  normalizeShoppingItemName,
} from './categorize.ts';

export {
  applyCategoryFlatOrder,
  buildShoppingListReorderPayload,
  groupShoppingListItemsByCategory,
  moveShoppingListItemToCategory,
  moveShoppingListItemWithinCategory,
  sortShoppingListItemsForDisplay,
} from './reorder.ts';

export type { ShoppingListItemLike, ShoppingListReorderChange } from './types.ts';
