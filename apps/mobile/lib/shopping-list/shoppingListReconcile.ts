import type { ShoppingCategory } from '@meal-diary/shared';

import { resolveShoppingListItemCategory } from '@/lib/shopping-list/shoppingListTree';
import type { ShoppingList, ShoppingListItem } from '@/types/shoppingList';

export interface ShoppingListReconcileAdd {
  tempId: string;
  name: string;
  category: ShoppingCategory;
  checked: boolean;
  position: number;
}

export interface ShoppingListReconcileUpdate {
  id: number;
  name?: string;
  checked?: boolean;
  category?: ShoppingCategory;
}

export interface ShoppingListReconcileReorder {
  id: number;
  category: ShoppingCategory;
  position: number;
}

export interface ShoppingListReconcilePlan {
  adds: ShoppingListReconcileAdd[];
  updates: ShoppingListReconcileUpdate[];
  deletes: number[];
  reorders: ShoppingListReconcileReorder[];
}

function itemCategory(item: ShoppingListItem): ShoppingCategory {
  return resolveShoppingListItemCategory(item.category);
}

/**
 * Diff the on-screen list against the last server copy.
 * Added-then-removed rows are omitted. A tick that was undone is omitted.
 */
export function planShoppingListReconcile(
  local: ShoppingList,
  baseline: ShoppingList
): ShoppingListReconcilePlan {
  const baselineById = new Map<number, ShoppingListItem>();
  for (const item of baseline.items) {
    if (typeof item.id === 'number') {
      baselineById.set(item.id, item);
    }
  }

  const localIds = new Set(local.items.map((item) => item.id));
  const adds: ShoppingListReconcileAdd[] = [];
  const updates: ShoppingListReconcileUpdate[] = [];
  const reorders: ShoppingListReconcileReorder[] = [];

  for (const item of local.items) {
    if (typeof item.id === 'string') {
      const name = item.name.trim();
      if (!name) {
        continue;
      }
      adds.push({
        tempId: item.id,
        name,
        category: itemCategory(item),
        checked: item.checked,
        position: item.position,
      });
      continue;
    }

    const base = baselineById.get(item.id);
    const category = itemCategory(item);
    if (!base) {
      if (item.checked) {
        updates.push({ id: item.id, checked: true });
      }
      reorders.push({ id: item.id, category, position: item.position });
      continue;
    }

    const patch: ShoppingListReconcileUpdate = { id: item.id };
    let changed = false;
    if (item.checked !== base.checked) {
      patch.checked = item.checked;
      changed = true;
    }
    if (item.name !== base.name) {
      patch.name = item.name;
      changed = true;
    }
    if (category !== itemCategory(base)) {
      patch.category = category;
      changed = true;
    }
    if (changed) {
      updates.push(patch);
    }
    if (item.position !== base.position || category !== itemCategory(base)) {
      reorders.push({ id: item.id, category, position: item.position });
    }
  }

  const deletes = baseline.items
    .filter((item) => typeof item.id === 'number' && !localIds.has(item.id))
    .map((item) => item.id as number);

  return { adds, updates, deletes, reorders };
}

export function isShoppingListReconcilePlanEmpty(plan: ShoppingListReconcilePlan): boolean {
  return (
    plan.adds.length === 0 &&
    plan.updates.length === 0 &&
    plan.deletes.length === 0 &&
    plan.reorders.length === 0
  );
}
