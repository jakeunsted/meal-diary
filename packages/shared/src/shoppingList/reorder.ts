import {
  DEFAULT_SHOPPING_CATEGORY,
  SHOPPING_CATEGORIES,
  isShoppingCategory,
  type ShoppingCategory,
} from './categories.ts';
import type { ShoppingListItemLike, ShoppingListReorderChange } from './types.ts';

function categorySortIndex(category: ShoppingCategory): number {
  const index = SHOPPING_CATEGORIES.indexOf(category);
  return index === -1 ? SHOPPING_CATEGORIES.length : index;
}

function resolveCategory(item: ShoppingListItemLike): ShoppingCategory {
  return isShoppingCategory(item.category) ? item.category : DEFAULT_SHOPPING_CATEGORY;
}

/** Sort by category order then position ascending. */
export function sortShoppingListItemsForDisplay<T extends ShoppingListItemLike>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const catDiff = categorySortIndex(resolveCategory(a)) - categorySortIndex(resolveCategory(b));
    if (catDiff !== 0) {
      return catDiff;
    }
    return a.position - b.position;
  });
}

/** Group items into ordered category buckets (empty categories included). */
export function groupShoppingListItemsByCategory<T extends ShoppingListItemLike>(
  items: T[]
): Record<ShoppingCategory, T[]> {
  const groups = Object.fromEntries(
    SHOPPING_CATEGORIES.map((category) => [category, [] as T[]])
  ) as Record<ShoppingCategory, T[]>;

  for (const item of sortShoppingListItemsForDisplay(items)) {
    groups[resolveCategory(item)].push(item);
  }

  return groups;
}

/**
 * Reorder an item within its own category.
 * `toIndex` is the destination index among siblings in that category.
 */
export function moveShoppingListItemWithinCategory<T extends ShoppingListItemLike>(
  items: T[],
  itemId: number | string,
  toIndex: number
): T[] {
  const target = items.find((item) => item.id === itemId);
  if (!target) {
    return items;
  }

  const category = resolveCategory(target);
  const siblings = sortShoppingListItemsForDisplay(
    items.filter((item) => resolveCategory(item) === category)
  );
  const fromIndex = siblings.findIndex((item) => item.id === itemId);
  if (fromIndex === -1 || fromIndex === toIndex) {
    return items;
  }

  const clampedTo = Math.max(0, Math.min(toIndex, siblings.length - 1));
  if (fromIndex === clampedTo) {
    return items;
  }

  const nextSiblings = [...siblings];
  const [moved] = nextSiblings.splice(fromIndex, 1);
  nextSiblings.splice(clampedTo, 0, moved);

  const positionById = new Map<number | string, number>();
  nextSiblings.forEach((item, index) => {
    positionById.set(item.id, index);
  });

  return items.map((item) => {
    if (resolveCategory(item) !== category) {
      return item;
    }
    const position = positionById.get(item.id);
    if (position === undefined || position === item.position) {
      return item;
    }
    return { ...item, position };
  });
}

/** Move an item to another category, appending at the end. */
export function moveShoppingListItemToCategory<T extends ShoppingListItemLike>(
  items: T[],
  itemId: number | string,
  category: ShoppingCategory
): T[] {
  const target = items.find((item) => item.id === itemId);
  if (!target) {
    return items;
  }

  const fromCategory = resolveCategory(target);
  if (fromCategory === category) {
    return items;
  }

  const destSiblings = items.filter(
    (item) => item.id !== itemId && resolveCategory(item) === category
  );
  const nextPosition =
    destSiblings.length === 0
      ? 0
      : Math.max(...destSiblings.map((item) => item.position)) + 1;

  // Reindex source category after removal.
  const remainingSource = sortShoppingListItemsForDisplay(
    items.filter((item) => item.id !== itemId && resolveCategory(item) === fromCategory)
  );
  const sourcePositionById = new Map<number | string, number>();
  remainingSource.forEach((item, index) => {
    sourcePositionById.set(item.id, index);
  });

  return items.map((item) => {
    if (item.id === itemId) {
      return { ...item, category, position: nextPosition };
    }
    if (resolveCategory(item) === fromCategory) {
      const position = sourcePositionById.get(item.id);
      if (position !== undefined && position !== item.position) {
        return { ...item, position };
      }
    }
    return item;
  });
}

/** Build reorder payload from current item state (positions reindexed per category). */
export function buildShoppingListReorderPayload(
  items: ShoppingListItemLike[]
): ShoppingListReorderChange[] {
  const groups = groupShoppingListItemsByCategory(items);
  const changes: ShoppingListReorderChange[] = [];

  for (const category of SHOPPING_CATEGORIES) {
    groups[category].forEach((item, index) => {
      changes.push({
        id: item.id,
        category,
        position: index,
      });
    });
  }

  return changes;
}

/**
 * Apply a flat order of ids within a single category, leaving other categories untouched.
 * Used after a drag-drop within a category tab or category block on All.
 */
export function applyCategoryFlatOrder<T extends ShoppingListItemLike>(
  items: T[],
  category: ShoppingCategory,
  orderedIds: Array<number | string>
): T[] {
  const positionById = new Map<number | string, number>();
  orderedIds.forEach((id, index) => {
    positionById.set(id, index);
  });

  return items.map((item) => {
    if (resolveCategory(item) !== category) {
      return item;
    }
    const position = positionById.get(item.id);
    if (position === undefined) {
      return item;
    }
    return position === item.position ? item : { ...item, position };
  });
}
