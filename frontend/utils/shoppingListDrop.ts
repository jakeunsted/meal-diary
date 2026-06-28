import type { IDragEvent } from '@vue-dnd-kit/core';
import type { ShoppingListItem } from '~/types/ShoppingList';
import {
  canBeShoppingListParent,
  isShoppingListDescendant,
  normalizeShoppingListParentId,
} from '~/utils/shoppingListTree';

/** Horizontal pointer offset from a row's left edge before a drop nests as a child. */
export const SHOPPING_LIST_NEST_POINTER_OFFSET_PX = 20;

export function shouldNestShoppingListItem(event: IDragEvent): boolean {
  const hovered = event.hoveredDraggable;
  if (!hovered?.element) {
    return false;
  }

  const hoveredItem = hovered.item as ShoppingListItem;
  if (!canBeShoppingListParent(hoveredItem)) {
    return false;
  }

  const pointerX = event.provider.pointer.value?.current.x ?? 0;
  const rowLeft = hovered.element.getBoundingClientRect().left;

  return pointerX >= rowLeft + SHOPPING_LIST_NEST_POINTER_OFFSET_PX;
}

export function applyShoppingListDropHierarchy(
  flatActiveItems: ShoppingListItem[],
  draggedIds: Set<number | string>,
  hoveredItem: ShoppingListItem | null,
  nestAsChild: boolean,
  allItems: ShoppingListItem[]
): ShoppingListItem[] {
  return flatActiveItems.map((item) => {
    if (!draggedIds.has(item.id) || !hoveredItem || item.id === hoveredItem.id) {
      return item;
    }

    if (nestAsChild && canBeShoppingListParent(hoveredItem) && typeof hoveredItem.id === 'number') {
      if (typeof item.id === 'number' && isShoppingListDescendant(allItems, item.id, hoveredItem.id)) {
        return item;
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
