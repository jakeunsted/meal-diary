import {
  buildShoppingListReorderPayload,
  DEFAULT_SHOPPING_CATEGORY,
  isShoppingCategory,
  sortShoppingListItemsForDisplay,
  type ShoppingCategory,
  type ShoppingListReorderChange,
} from '@meal-diary/shared';
import type { ShoppingListItem } from '~/types/ShoppingList';

export interface ShoppingListItemReorderChange {
  id: number | string;
  category: string;
  position: number;
}

function toItemLike(items: ShoppingListItem[]) {
  return items.map((item) => ({
    ...item,
    category: (isShoppingCategory(item.category)
      ? item.category
      : DEFAULT_SHOPPING_CATEGORY) as ShoppingCategory,
  }));
}

/** Sort unchecked/active items by category then position for display. */
export function flattenShoppingListItems(items: ShoppingListItem[]): ShoppingListItem[] {
  return sortShoppingListItemsForDisplay(toItemLike(items)) as ShoppingListItem[];
}

/** Build reorder payload (category + reindexed position) from a flat item list. */
export function rebuildItemOrderFromFlatItems(
  flatOrder: ShoppingListItem[]
): ShoppingListItemReorderChange[] {
  const changes: ShoppingListReorderChange[] = buildShoppingListReorderPayload(toItemLike(flatOrder));
  return changes.map((change) => ({
    id: change.id,
    category: change.category,
    position: change.position,
  }));
}

/**
 * Insert a new item directly after an existing one, inheriting its category
 * and reindexing positions within that category.
 */
export function insertShoppingListItemAfter(
  items: ShoppingListItem[],
  existingItemId: number | string,
  newItem: ShoppingListItem
): ShoppingListItem[] {
  const existing = items.find((item) => item.id === existingItemId);
  if (!existing) {
    const category = isShoppingCategory(newItem.category)
      ? newItem.category
      : DEFAULT_SHOPPING_CATEGORY;
    const siblings = items.filter((item) => item.category === category);
    const nextPosition = siblings.length
      ? Math.max(...siblings.map((item) => item.position)) + 1
      : 0;
    return [...items, { ...newItem, category, position: nextPosition }];
  }

  const category = isShoppingCategory(existing.category)
    ? existing.category
    : DEFAULT_SHOPPING_CATEGORY;

  const categoryItems = sortShoppingListItemsForDisplay(
    toItemLike(items.filter((item) => item.category === category))
  );
  const existingIndex = categoryItems.findIndex((item) => item.id === existingItemId);
  const inserted: ShoppingListItem = {
    ...newItem,
    category,
    position: existingIndex + 1,
  };

  const nextCategoryItems = [...categoryItems];
  nextCategoryItems.splice(existingIndex + 1, 0, inserted as typeof categoryItems[number]);

  const positionById = new Map<number | string, number>();
  nextCategoryItems.forEach((item, index) => {
    positionById.set(item.id, index);
  });

  const withoutExistingCategory = items.filter((item) => item.category !== category);
  const reindexedCategory = nextCategoryItems.map((item) => ({
    ...item,
    category,
    position: positionById.get(item.id) ?? item.position,
  })) as ShoppingListItem[];

  return [...withoutExistingCategory, ...reindexedCategory];
}
