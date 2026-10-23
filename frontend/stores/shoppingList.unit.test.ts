import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { ShoppingListItem } from '~/types/ShoppingList';

const api = vi.fn();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('~/composables/useApi', () => ({
  useApi: () => ({ api }),
}));

vi.mock('~/composables/useConnection', () => ({
  useConnection: () => ({ checkConnection: async () => true }),
}));

import { useShoppingListStore } from './shoppingList';
import { useUserStore } from './user';

vi.stubGlobal('useUserStore', useUserStore);

const savedItem = (id: number): ShoppingListItem => ({
  id,
  shopping_list_id: 1,
  name: 'Milk',
  checked: false,
  deleted: false,
  created_by: 3,
  category: 'dairy',
  position: 0,
  created_at: '',
  updated_at: '',
});

describe('shopping list store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.mockReset();
    useUserStore().user = { id: 3, family_group_id: 9 } as never;
  });

  it('keeps a temp row and pending add when the API fails, and replaces them on success', async () => {
    const store = useShoppingListStore();
    store.shoppingList = {
      id: 1,
      family_group_id: 9,
      created_at: '',
      updated_at: '',
      items: [],
    };

    api.mockRejectedValueOnce(new Error('offline'));
    await store.addItem({ name: 'Milk' });

    expect(store.shoppingList.items).toHaveLength(1);
    expect(String(store.shoppingList.items[0].id).startsWith('temp_')).toBe(true);
    expect(store.pendingChanges.add).toHaveLength(1);
    expect(store.error).toBe('offline');

    api.mockResolvedValueOnce(savedItem(55));
    await store.addItem({ name: 'Milk' });

    expect(store.shoppingList.items.map((item) => item.id)).toContain(55);
    expect(store.pendingChanges.add.some((item) => item.id === 55)).toBe(false);
    expect(store.pendingChanges.add).toHaveLength(1);
  });

  it('deletes a temp item locally without calling the API', async () => {
    const store = useShoppingListStore();
    const temp = savedItem('temp_local');
    store.shoppingList = {
      id: 1,
      family_group_id: 9,
      created_at: '',
      updated_at: '',
      items: [temp],
    };
    store.pendingChanges.add = [temp];

    await store.deleteItem('temp_local');

    expect(api).not.toHaveBeenCalled();
    expect(store.shoppingList.items).toEqual([]);
    expect(store.pendingChanges.add).toEqual([]);
  });
});
