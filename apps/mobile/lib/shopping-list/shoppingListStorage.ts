import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ShoppingList } from '@/types/shoppingList';

const CACHE_PREFIX = 'shopping-list-cache';
export const SHOPPING_LIST_CACHE_TTL_MS = 5 * 60 * 1000;

export interface CachedShoppingList {
  shoppingList: ShoppingList;
  lastFetchTime: number;
  /** Last list returned by the server. Reconnect diffs the on-screen list against this. */
  baseline: ShoppingList;
  dirty: boolean;
}

const memory = new Map<number, CachedShoppingList>();
const dirtyEpoch = new Map<number, number>();

let reconcileDone: Promise<void> = Promise.resolve();

function buildCacheKey(familyGroupId: number): string {
  return `${CACHE_PREFIX}:${familyGroupId}`;
}

export function isShoppingListCacheFresh(lastFetchTime: number, now = Date.now()): boolean {
  return now - lastFetchTime <= SHOPPING_LIST_CACHE_TTL_MS;
}

/** Pause list reads until the current reconnect sync finishes. */
export function startShoppingListReconcileHold(): () => void {
  let release!: () => void;
  reconcileDone = new Promise((resolve) => {
    release = resolve;
  });
  return () => {
    release();
    reconcileDone = Promise.resolve();
  };
}

export function waitForShoppingListReconcile(): Promise<void> {
  return reconcileDone;
}

function remember(familyGroupId: number, cached: CachedShoppingList): void {
  memory.set(familyGroupId, cached);
  void persistCachedShoppingList(familyGroupId, cached);
}

async function persistCachedShoppingList(
  familyGroupId: number,
  cached: CachedShoppingList
): Promise<void> {
  if (memory.get(familyGroupId) !== cached) {
    return;
  }

  try {
    await AsyncStorage.setItem(buildCacheKey(familyGroupId), JSON.stringify(cached));
  } catch (error) {
    console.warn('[shoppingListStorage] Failed to save cache', error);
  }
}

function isCachedShoppingList(value: unknown): value is CachedShoppingList {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const parsed = value as Partial<CachedShoppingList>;
  return (
    !!parsed.shoppingList &&
    Array.isArray(parsed.shoppingList.items) &&
    typeof parsed.lastFetchTime === 'number'
  );
}

export async function loadShoppingListCache(
  familyGroupId: number
): Promise<CachedShoppingList | null> {
  const existing = memory.get(familyGroupId);
  if (existing) {
    return existing;
  }

  try {
    const raw = await AsyncStorage.getItem(buildCacheKey(familyGroupId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isCachedShoppingList(parsed)) {
      await AsyncStorage.removeItem(buildCacheKey(familyGroupId));
      return null;
    }

    const cached: CachedShoppingList = {
      shoppingList: parsed.shoppingList,
      lastFetchTime: parsed.lastFetchTime,
      baseline: parsed.baseline ?? parsed.shoppingList,
      dirty: parsed.dirty ?? false,
    };
    memory.set(familyGroupId, cached);

    if (!parsed.baseline || parsed.dirty === undefined) {
      void persistCachedShoppingList(familyGroupId, cached);
    }

    return cached;
  } catch (error) {
    console.warn('[shoppingListStorage] Failed to load cache', error);
    await AsyncStorage.removeItem(buildCacheKey(familyGroupId));
    return null;
  }
}

/** Last viewed list. Keeps the server baseline and dirty flag. */
export async function saveShoppingListCache(
  familyGroupId: number,
  shoppingList: ShoppingList
): Promise<void> {
  const existing = memory.get(familyGroupId) ?? (await loadShoppingListCache(familyGroupId));
  remember(familyGroupId, {
    shoppingList,
    lastFetchTime: existing?.lastFetchTime ?? Date.now(),
    baseline: existing?.baseline ?? shoppingList,
    dirty: existing?.dirty ?? false,
  });
}

export function getShoppingListDirtyEpoch(familyGroupId: number): number {
  return dirtyEpoch.get(familyGroupId) ?? 0;
}

/**
 * Replace both copies after a successful server read or sync.
 * Returns false when a local edit landed after `epoch` was captured.
 */
export async function saveShoppingListServerCopy(
  familyGroupId: number,
  shoppingList: ShoppingList,
  epoch = getShoppingListDirtyEpoch(familyGroupId)
): Promise<boolean> {
  if (getShoppingListDirtyEpoch(familyGroupId) !== epoch) {
    return false;
  }
  remember(familyGroupId, {
    shoppingList,
    baseline: shoppingList,
    dirty: false,
    lastFetchTime: Date.now(),
  });
  return getShoppingListDirtyEpoch(familyGroupId) === epoch;
}

/** Keep the on-screen list and record that it still needs a sync. */
export async function markShoppingListDirty(familyGroupId: number): Promise<void> {
  dirtyEpoch.set(familyGroupId, (dirtyEpoch.get(familyGroupId) ?? 0) + 1);
  const existing = memory.get(familyGroupId) ?? (await loadShoppingListCache(familyGroupId));
  if (!existing) {
    return;
  }
  remember(familyGroupId, {
    ...existing,
    dirty: true,
  });
}

/** After a successful online write, adopt the on-screen list only if nothing newer is pending. */
export async function adoptShoppingListIfClean(
  familyGroupId: number,
  shoppingList: ShoppingList
): Promise<void> {
  const epoch = getShoppingListDirtyEpoch(familyGroupId);
  const existing = memory.get(familyGroupId) ?? (await loadShoppingListCache(familyGroupId));
  if (existing?.dirty || getShoppingListDirtyEpoch(familyGroupId) !== epoch) {
    return;
  }
  await saveShoppingListServerCopy(familyGroupId, shoppingList, epoch);
}

/** Update the server snapshot without replacing offline edits still on screen. */
export async function saveShoppingListBaseline(
  familyGroupId: number,
  baseline: ShoppingList
): Promise<void> {
  const existing = memory.get(familyGroupId) ?? (await loadShoppingListCache(familyGroupId));
  remember(familyGroupId, {
    shoppingList: existing?.shoppingList ?? baseline,
    baseline,
    dirty: existing?.dirty ?? false,
    lastFetchTime: Date.now(),
  });
}

export async function clearShoppingListCache(familyGroupId?: number): Promise<void> {
  try {
    if (familyGroupId != null) {
      memory.delete(familyGroupId);
      dirtyEpoch.delete(familyGroupId);
      await AsyncStorage.removeItem(buildCacheKey(familyGroupId));
      return;
    }

    memory.clear();
    dirtyEpoch.clear();
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith(`${CACHE_PREFIX}:`));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (error) {
    console.warn('[shoppingListStorage] Failed to clear cache', error);
  }
}
