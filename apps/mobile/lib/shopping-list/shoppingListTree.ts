import {
  DEFAULT_SHOPPING_CATEGORY,
  isShoppingCategory,
  sortShoppingListItemsForDisplay,
  type ShoppingCategory,
} from '@meal-diary/shared';

import type { ShoppingListItem, ShoppingListItemReorderChange } from '@/types/shoppingList';

export function resolveShoppingListItemCategory(
  category: ShoppingCategory | string | null | undefined
): ShoppingCategory {
  return isShoppingCategory(category) ? category : DEFAULT_SHOPPING_CATEGORY;
}

/** Sort items by category then position (display order). */
export function flattenShoppingListItems(items: ShoppingListItem[]): ShoppingListItem[] {
  return sortShoppingListItemsForDisplay(
    items.map((item) => ({
      ...item,
      category: resolveShoppingListItemCategory(item.category),
    }))
  );
}

export function getActiveFlatShoppingListItems(items: ShoppingListItem[]): ShoppingListItem[] {
  return flattenShoppingListItems(items.filter((item) => !item.checked));
}

export function toPersistableReorderPayload(
  changes: ShoppingListItemReorderChange[]
): ShoppingListItemReorderChange[] {
  return changes.map(({ id, category, position }) => ({
    id,
    category,
    position,
  }));
}

export function isTempShoppingListItemId(id: number | string): boolean {
  return typeof id === 'string' && id.startsWith('temp_');
}

export function generateTempShoppingListItemId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function insertShoppingListItemAfter(
  items: ShoppingListItem[],
  shoppingListId: number,
  existingItemId: number | string,
  createdBy: number,
  name = ''
): { items: ShoppingListItem[]; tempItem: ShoppingListItem } | null {
  const existing = items.find((item) => item.id === existingItemId);
  if (!existing) {
    return null;
  }

  const category = resolveShoppingListItemCategory(existing.category);
  const categoryItems = flattenShoppingListItems(
    items.filter((item) => resolveShoppingListItemCategory(item.category) === category)
  );
  const siblingIndex = categoryItems.findIndex((item) => item.id === existingItemId);
  if (siblingIndex === -1) {
    return null;
  }

  const now = new Date().toISOString();
  const tempItem: ShoppingListItem = {
    id: generateTempShoppingListItemId(),
    shopping_list_id: shoppingListId,
    name,
    checked: false,
    deleted: false,
    category,
    position: siblingIndex + 1,
    created_at: now,
    updated_at: now,
    created_by: createdBy,
  };

  const nextCategoryItems = [...categoryItems];
  nextCategoryItems.splice(siblingIndex + 1, 0, tempItem);

  const positionById = new Map<number | string, number>();
  nextCategoryItems.forEach((item, index) => {
    positionById.set(item.id, index);
  });

  const nextItems = items.map((item) => {
    if (resolveShoppingListItemCategory(item.category) !== category) {
      return item;
    }
    const position = positionById.get(item.id);
    if (position === undefined || position === item.position) {
      return item;
    }
    return { ...item, position };
  });

  nextItems.push({
    ...tempItem,
    position: positionById.get(tempItem.id) ?? tempItem.position,
  });

  return {
    items: nextItems,
    tempItem: {
      ...tempItem,
      position: positionById.get(tempItem.id) ?? tempItem.position,
    },
  };
}
