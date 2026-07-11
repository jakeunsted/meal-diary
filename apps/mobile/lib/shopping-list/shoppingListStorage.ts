import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ShoppingList } from '@/types/shoppingList';

const CACHE_PREFIX = 'shopping-list-cache';
export const SHOPPING_LIST_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedShoppingList {
  shoppingList: ShoppingList;
  lastFetchTime: number;
}

function buildCacheKey(familyGroupId: number): string {
  return `${CACHE_PREFIX}:${familyGroupId}`;
}

export function isShoppingListCacheFresh(lastFetchTime: number, now = Date.now()): boolean {
  return now - lastFetchTime <= SHOPPING_LIST_CACHE_TTL_MS;
}

export async function loadShoppingListCache(
  familyGroupId: number
): Promise<CachedShoppingList | null> {
  try {
    const raw = await AsyncStorage.getItem(buildCacheKey(familyGroupId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedShoppingList;
    if (
      !parsed.shoppingList ||
      !Array.isArray(parsed.shoppingList.items) ||
      typeof parsed.lastFetchTime !== 'number'
    ) {
      await AsyncStorage.removeItem(buildCacheKey(familyGroupId));
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('[shoppingListStorage] Failed to load cache', error);
    await AsyncStorage.removeItem(buildCacheKey(familyGroupId));
    return null;
  }
}

export async function saveShoppingListCache(
  familyGroupId: number,
  shoppingList: ShoppingList,
  lastFetchTime = Date.now()
): Promise<void> {
  try {
    const payload: CachedShoppingList = {
      shoppingList,
      lastFetchTime,
    };
    await AsyncStorage.setItem(buildCacheKey(familyGroupId), JSON.stringify(payload));
  } catch (error) {
    console.warn('[shoppingListStorage] Failed to save cache', error);
  }
}

export async function clearShoppingListCache(familyGroupId?: number): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const prefix = familyGroupId ? `${CACHE_PREFIX}:${familyGroupId}` : `${CACHE_PREFIX}:`;
    const cacheKeys = keys.filter((key) => key.startsWith(prefix));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (error) {
    console.warn('[shoppingListStorage] Failed to clear cache', error);
  }
}
