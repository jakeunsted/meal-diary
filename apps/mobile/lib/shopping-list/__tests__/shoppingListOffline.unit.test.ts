import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import { ShoppingListOfflineQueuedError } from '@/lib/shopping-list/shoppingListOfflineError';
import type { ShoppingList, ShoppingListItem } from '@/types/shoppingList';

const store = new Map<string, string>();
const getNetworkStateAsync = vi.hoisted(() => vi.fn());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    getAllKeys: async () => [...store.keys()],
    multiRemove: async (keys: string[]) => {
      for (const key of keys) {
        store.delete(key);
      }
    },
  },
}));

vi.mock('expo-network', () => ({
  getNetworkStateAsync,
}));

vi.mock('@/lib/shopping-list/shoppingListSync', () => ({
  setShoppingListDirtyStatus: vi.fn(),
  flushShoppingListPendingOps: vi.fn(),
}));

import { commitShoppingListWrite } from '@/lib/shopping-list/shoppingListCommit';
import {
  clearShoppingListCache,
  isShoppingListCacheFresh,
  loadShoppingListCache,
  saveShoppingListCache,
  saveShoppingListServerCopy,
} from '@/lib/shopping-list/shoppingListStorage';

function item(overrides: Partial<ShoppingListItem> & Pick<ShoppingListItem, 'id'>): ShoppingListItem {
  return {
    shopping_list_id: 1,
    name: 'Milk',
    checked: false,
    deleted: false,
    created_by: 1,
    category: 'other',
    position: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function list(items: ShoppingListItem[]): ShoppingList {
  return {
    id: 1,
    family_group_id: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    items,
  };
}

describe('shopping list device cache', () => {
  beforeEach(async () => {
    store.clear();
    await clearShoppingListCache();
    getNetworkStateAsync.mockReset();
  });

  it('returns a last viewed list older than 5 minutes without a network call', async () => {
    const viewed = list([item({ id: 1, name: 'Milk', checked: true })]);
    const lastFetchTime = Date.now() - 10 * 60 * 1000;
    store.set(
      'shopping-list-cache:1',
      JSON.stringify({
        shoppingList: viewed,
        baseline: list([item({ id: 1, name: 'Milk', checked: false })]),
        dirty: true,
        lastFetchTime,
      })
    );

    const cached = await loadShoppingListCache(1);

    expect(isShoppingListCacheFresh(lastFetchTime)).toBe(false);
    expect(cached?.shoppingList.items[0]?.checked).toBe(true);
    expect(cached?.baseline.items[0]?.checked).toBe(false);
    expect(getNetworkStateAsync).not.toHaveBeenCalled();
  });

  it('keeps an offline tick in the stored list and does not call the server', async () => {
    const serverList = list([item({ id: 1, name: 'Milk', checked: false })]);
    await saveShoppingListServerCopy(1, serverList);
    await saveShoppingListCache(
      1,
      list([item({ id: 1, name: 'Milk', checked: true })])
    );

    getNetworkStateAsync.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });
    const request = vi.fn();

    await expect(commitShoppingListWrite({} as never, 1, request)).rejects.toBeInstanceOf(
      ShoppingListOfflineQueuedError
    );

    const cached = await loadShoppingListCache(1);
    expect(request).not.toHaveBeenCalled();
    expect(cached?.dirty).toBe(true);
    expect(cached?.shoppingList.items[0]?.checked).toBe(true);
    expect(cached?.baseline.items[0]?.checked).toBe(false);
  });

  it('rethrows a 400 and leaves the server copy in place', async () => {
    await saveShoppingListServerCopy(1, list([item({ id: 1, checked: false })]));
    getNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    const request = vi.fn().mockRejectedValue(new ApiError(400, 'Name is required'));

    await expect(commitShoppingListWrite({} as never, 1, request)).rejects.toBeInstanceOf(
      ApiError
    );

    const cached = await loadShoppingListCache(1);
    expect(request).toHaveBeenCalledOnce();
    expect(cached?.dirty).toBe(false);
    expect(cached?.shoppingList.items[0]?.checked).toBe(false);
  });

  it('keeps the on-screen list when the request fails before the API responds', async () => {
    await saveShoppingListServerCopy(1, list([item({ id: 1, checked: false })]));
    await saveShoppingListCache(1, list([item({ id: 1, checked: true })]));
    getNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    const request = vi.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(commitShoppingListWrite({} as never, 1, request)).rejects.toBeInstanceOf(
      ShoppingListOfflineQueuedError
    );

    const cached = await loadShoppingListCache(1);
    expect(cached?.dirty).toBe(true);
    expect(cached?.shoppingList.items[0]?.checked).toBe(true);
  });
});
