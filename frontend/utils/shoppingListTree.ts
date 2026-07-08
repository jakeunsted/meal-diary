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
 * After parent_item_id changes, direct children of items that became nested
 * are reparented to the same parent to preserve one-level hierarchy.
 */
export function enforceOneLevelShoppingListNesting(
  before: ShoppingListItem[],
  after: ShoppingListItem[]
): ShoppingListItem[] {
  const promotions = new Map<number | string, number | null>();

  for (const next of after) {
    const prev = before.find((item) => item.id === next.id);
    if (!prev) {
      continue;
    }

    const prevParent = prev.parent_item_id ?? null;
    const nextParent = next.parent_item_id ?? null;

    if (nextParent === null || prevParent === nextParent) {
      continue;
    }

    for (const candidate of after) {
      if (candidate.parent_item_id === next.id) {
        promotions.set(candidate.id, nextParent);
      }
    }
  }

  if (promotions.size === 0) {
    return after;
  }

  return after.map((item) => {
    const promotedParent = promotions.get(item.id);
    if (promotedParent !== undefined) {
      return { ...item, parent_item_id: promotedParent };
    }
    return item;
  });
}

export function indentShoppingListActiveItem(
  activeItems: ShoppingListItem[],
  itemId: number | string
): ShoppingListItem[] | null {
  const index = activeItems.findIndex((item) => item.id === itemId);
  if (index <= 0) {
    return null;
  }

  const previous = activeItems[index - 1];
  const target = activeItems[index];
  const newParentId = resolveShoppingListIndentParent(previous);

  if (target.parent_item_id === newParentId) {
    return null;
  }

  const withIndent = activeItems.map((item) =>
    item.id === itemId ? { ...item, parent_item_id: newParentId } : item
  );

  return enforceOneLevelShoppingListNesting(activeItems, withIndent);
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

/** Parent plus direct children, or a child's parent and all siblings. */
export function getShoppingListFamilyIds(
  item: ShoppingListItem,
  allItems: ShoppingListItem[]
): Array<number | string> {
  if (item.parent_item_id !== null) {
    const parent = allItems.find((entry) => entry.id === item.parent_item_id);
    const siblings = allItems.filter((entry) => entry.parent_item_id === item.parent_item_id);
    const ids: Array<number | string> = [];

    if (parent) {
      ids.push(parent.id);
    }

    for (const sibling of siblings) {
      ids.push(sibling.id);
    }

    return ids.length > 0 ? ids : [item.id];
  }

  if (typeof item.id !== 'number') {
    return [item.id];
  }

  const children = allItems.filter((entry) => entry.parent_item_id === item.id);
  return [item.id, ...children.map((child) => child.id)];
}

/** IDs that should be checked/unchecked together for parent/child grouping. */
export function getShoppingListCheckedUpdateIds(
  item: ShoppingListItem,
  allItems: ShoppingListItem[],
  checked: boolean
): Array<number | string> {
  if (checked && item.parent_item_id === null) {
    return getShoppingListFamilyIds(item, allItems);
  }

  if (!checked) {
    return getShoppingListFamilyIds(item, allItems);
  }

  return [item.id];
}
