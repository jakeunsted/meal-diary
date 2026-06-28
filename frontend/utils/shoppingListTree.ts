import type { ShoppingListItem } from '~/types/ShoppingList';

export interface ShoppingListItemReorderChange {
  id: number | string;
  parent_item_id: number | null;
  position: number;
}

export function flattenShoppingListItems(items: ShoppingListItem[]): ShoppingListItem[] {
  const siblingsByParent = new Map<number | null, ShoppingListItem[]>();

  for (const item of items) {
    const parentId = item.parent_item_id ?? null;
    const siblings = siblingsByParent.get(parentId) ?? [];
    siblings.push(item);
    siblingsByParent.set(parentId, siblings);
  }

  for (const siblings of siblingsByParent.values()) {
    siblings.sort((a, b) => a.position - b.position);
  }

  const flattened: ShoppingListItem[] = [];

  const walk = (parentId: number | null) => {
    const siblings = siblingsByParent.get(parentId) ?? [];
    for (const item of siblings) {
      flattened.push(item);
      if (typeof item.id === 'number') {
        walk(item.id);
      }
    }
  };

  walk(null);
  return flattened;
}

export function rebuildItemHierarchyFromFlatOrder(
  flatOrder: ShoppingListItem[]
): ShoppingListItemReorderChange[] {
  const positionsByParent = new Map<number | null, number>();

  return flatOrder.map((item) => {
    const parentId = item.parent_item_id ?? null;
    const position = positionsByParent.get(parentId) ?? 0;
    positionsByParent.set(parentId, position + 1);

    return {
      id: item.id,
      parent_item_id: parentId,
      position,
    };
  });
}

export function isShoppingListDescendant(
  items: ShoppingListItem[],
  ancestorId: number,
  candidateId: number | string
): boolean {
  let current = items.find((item) => item.id === candidateId);

  while (current?.parent_item_id != null) {
    if (current.parent_item_id === ancestorId) {
      return true;
    }
    current = items.find((item) => item.id === current?.parent_item_id);
  }

  return false;
}

/** Shopping lists support one level of nesting: root items and their direct children. */
export function canBeShoppingListParent(item: ShoppingListItem): boolean {
  return item.parent_item_id === null && typeof item.id === 'number';
}

/**
 * Resolve the parent when indenting: become a child of the previous root item,
 * or join the previous child item's grouping.
 */
export function resolveShoppingListIndentParent(previous: ShoppingListItem): number | null {
  if (previous.parent_item_id === null) {
    return typeof previous.id === 'number' ? previous.id : null;
  }

  return previous.parent_item_id;
}

export function normalizeShoppingListParentId(
  parentId: number | null,
  allItems: ShoppingListItem[]
): number | null {
  if (parentId === null) {
    return null;
  }

  const parent = allItems.find((item) => item.id === parentId);
  if (!parent || parent.parent_item_id !== null) {
    return null;
  }

  return parentId;
}
