import type { ShoppingListItem } from '@/types/shoppingList';
import {
  canBeShoppingListParent,
  enforceOneLevelShoppingListNesting,
  isShoppingListDescendant,
  normalizeShoppingListParentId,
} from '@/lib/shopping-list/shoppingListTree';

/** Horizontal pointer offset from a row's left edge before a drop nests as a child. */
export const SHOPPING_LIST_NEST_POINTER_OFFSET_PX = 20;

/** Drag-handle rightward movement before a drop nests as a child. */
export const SHOPPING_LIST_NEST_DRAG_OFFSET_PX = 28;

export function shouldNestShoppingListItemByOffset(translationX: number): boolean {
  return translationX >= SHOPPING_LIST_NEST_DRAG_OFFSET_PX;
}

export function reorderShoppingListActiveItems(
  activeItems: ShoppingListItem[],
  fromIndex: number,
  toIndex: number
): ShoppingListItem[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= activeItems.length ||
    toIndex >= activeItems.length ||
    fromIndex === toIndex
  ) {
    return activeItems;
  }

  const result = [...activeItems];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Item immediately above the drop index in the final flat order.
 * Used as the nest/sibling reference after a drag ends.
 */
export function resolveShoppingListDropHoveredItem(
  reorderedItems: ShoppingListItem[],
  _fromIndex: number,
  dropIndex: number,
  draggedId: number | string
): ShoppingListItem | null {
  if (!reorderedItems.length) {
    return null;
  }

  for (let index = Math.min(dropIndex, reorderedItems.length - 1) - 1; index >= 0; index -= 1) {
    const candidate = reorderedItems[index];
    if (candidate && candidate.id !== draggedId) {
      return candidate;
    }
  }

  return null;
}

/** Item immediately below the drop index in the final flat order. */
export function resolveShoppingListDropItemBelow(
  reorderedItems: ShoppingListItem[],
  dropIndex: number,
  draggedId: number | string
): ShoppingListItem | null {
  for (let index = dropIndex + 1; index < reorderedItems.length; index += 1) {
    const candidate = reorderedItems[index];
    if (candidate && candidate.id !== draggedId) {
      return candidate;
    }
  }

  return null;
}

/**
 * Keep-style parent for a dropped item (one-level nesting):
 * - after a child → always join that child's parent
 * - between a root and its existing child → nest under that root
 * - after a root + nest gesture → nest under that root
 * - after a root without nest gesture / no child below → become a root sibling
 */
export function resolveShoppingListDropHierarchy(
  itemAbove: ShoppingListItem | null,
  nestGesture: boolean,
  allItems: ShoppingListItem[],
  itemBelow: ShoppingListItem | null = null
): { hoveredItem: ShoppingListItem | null; nestAsChild: boolean } {
  if (!itemAbove) {
    return { hoveredItem: null, nestAsChild: false };
  }

  if (itemAbove.parent_item_id !== null) {
    const parent = allItems.find((item) => item.id === itemAbove.parent_item_id);
    if (parent && canBeShoppingListParent(parent)) {
      return { hoveredItem: parent, nestAsChild: true };
    }

    return { hoveredItem: itemAbove, nestAsChild: false };
  }

  if (canBeShoppingListParent(itemAbove)) {
    const insertingIntoChildBlock =
      itemBelow !== null &&
      itemBelow.parent_item_id === itemAbove.id;

    if (insertingIntoChildBlock || nestGesture) {
      return { hoveredItem: itemAbove, nestAsChild: true };
    }
  }

  return { hoveredItem: itemAbove, nestAsChild: false };
}

/** @deprecated Prefer resolveShoppingListDropHierarchy */
export function resolveShoppingListDropParent(
  itemAbove: ShoppingListItem | null,
  allItems: ShoppingListItem[],
  nestGesture = true
): ShoppingListItem | null {
  const { hoveredItem, nestAsChild } = resolveShoppingListDropHierarchy(
    itemAbove,
    nestGesture,
    allItems
  );
  return nestAsChild ? hoveredItem : null;
}

/** @deprecated Prefer resolveShoppingListDropHierarchy */
export function resolveShoppingListNestParent(
  hoveredItem: ShoppingListItem | null,
  allItems: ShoppingListItem[]
): ShoppingListItem | null {
  return resolveShoppingListDropParent(hoveredItem, allItems, true);
}

export function computeShoppingListDragPreview(
  activeItems: ShoppingListItem[],
  fromIndex: number,
  placeholderIndex: number,
  draggedIds: Set<number | string>,
  pointerX: number,
  hoveredRowLeft: number,
  allItems: ShoppingListItem[]
): { items: ShoppingListItem[]; nestTargetId: number | string | null } {
  const reorderedItems = reorderShoppingListActiveItems(activeItems, fromIndex, placeholderIndex);
  const draggedId = activeItems[fromIndex]?.id;
  const itemAbove = draggedId
    ? resolveShoppingListDropHoveredItem(reorderedItems, fromIndex, placeholderIndex, draggedId)
    : null;
  const itemBelow = draggedId
    ? resolveShoppingListDropItemBelow(reorderedItems, placeholderIndex, draggedId)
    : null;
  const nestGesture = itemAbove
    ? shouldNestShoppingListItemAtPointer(pointerX, hoveredRowLeft, itemAbove) ||
      shouldNestShoppingListItemByOffset(pointerX - hoveredRowLeft)
    : false;
  const { hoveredItem, nestAsChild } = resolveShoppingListDropHierarchy(
    itemAbove,
    nestGesture,
    allItems,
    itemBelow
  );

  return {
    items: applyShoppingListDropHierarchy(
      reorderedItems,
      draggedIds,
      hoveredItem,
      nestAsChild,
      allItems
    ),
    nestTargetId: nestAsChild && hoveredItem ? hoveredItem.id : null,
  };
}

export function shouldNestShoppingListItemAtPointer(
  pointerX: number,
  rowLeft: number,
  hoveredItem: ShoppingListItem
): boolean {
  if (!canBeShoppingListParent(hoveredItem)) {
    return false;
  }

  return pointerX >= rowLeft + SHOPPING_LIST_NEST_POINTER_OFFSET_PX;
}

export function applyShoppingListDropHierarchy(
  flatActiveItems: ShoppingListItem[],
  draggedIds: Set<number | string>,
  hoveredItem: ShoppingListItem | null,
  nestAsChild: boolean,
  allItems: ShoppingListItem[]
): ShoppingListItem[] {
  const withHierarchy = flatActiveItems.map((item) => {
    if (!draggedIds.has(item.id)) {
      return item;
    }

    if (!hoveredItem || item.id === hoveredItem.id) {
      return {
        ...item,
        parent_item_id: null,
      };
    }

    if (nestAsChild && canBeShoppingListParent(hoveredItem) && typeof hoveredItem.id === 'number') {
      if (typeof item.id === 'number' && isShoppingListDescendant(allItems, item.id, hoveredItem.id)) {
        return {
          ...item,
          parent_item_id: null,
        };
      }

      return {
        ...item,
        parent_item_id: hoveredItem.id,
      };
    }

    return {
      ...item,
      parent_item_id: normalizeShoppingListParentId(hoveredItem.parent_item_id ?? null, allItems),
    };
  });

  return enforceOneLevelShoppingListNesting(flatActiveItems, withHierarchy);
}

export function buildShoppingListDepthMap(items: ShoppingListItem[]): Record<number, number> {
  const depthMap: Record<number, number> = {};
  const byId = new Map<number, { id: number; parent_item_id: number | null }>();

  for (const item of items) {
    if (typeof item.id === 'number') {
      byId.set(item.id, { id: item.id, parent_item_id: item.parent_item_id });
    }
  }

  const computeDepth = (id: number, visited: Set<number>): number => {
    if (depthMap[id] !== undefined) {
      return depthMap[id];
    }
    if (visited.has(id)) {
      return 0;
    }
    visited.add(id);
    const entry = byId.get(id);
    if (!entry || entry.parent_item_id === null) {
      depthMap[id] = 0;
      return 0;
    }
    const parentDepth = computeDepth(entry.parent_item_id, visited);
    const depth = parentDepth + 1;
    depthMap[id] = depth;
    return depth;
  };

  for (const entry of byId.values()) {
    computeDepth(entry.id, new Set<number>());
  }

  return depthMap;
}

export function getShoppingListItemDepth(
  item: ShoppingListItem,
  depthMap: Record<number, number>
): number {
  if (typeof item.id === 'number') {
    return depthMap[item.id] ?? 0;
  }

  if (item.parent_item_id !== null) {
    return 1;
  }

  return 0;
}
