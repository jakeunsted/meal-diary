import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
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
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: storage,
}));

import { resolveStaleFetch, toRecipeSyncValue } from '@meal-diary/shared';

import {
  clearRecipePendingQueues,
  getRecipePendingEdits,
  recordRecipePendingEdit,
} from '@/lib/recipe/recipePendingQueue';
import {
  bumpRecipeDetailRevision,
  readRecipeDetailRevision,
  resetRecipeFetchRevisions,
} from '@/lib/recipe/recipeFetchRevision';

const value = (name: string) => toRecipeSyncValue({
  name,
  description: null,
  instructions: 'Simmer',
  portions: 2,
  ingredients: [{ name: 'Onion', quantity: 1, unit: null }],
  category_ids: [],
});

describe('recipe pending queue', () => {
  beforeEach(async () => {
    storage.store.clear();
    await clearRecipePendingQueues();
    resetRecipeFetchRevisions();
  });

  it('keeps the first baseline when a later edit replaces yours', async () => {
    await recordRecipePendingEdit(4, {
      recipeId: 7,
      baseline: value('Soup'),
      recipe: value('Stew'),
    });
    await recordRecipePendingEdit(4, {
      recipeId: 7,
      baseline: value('Stew'),
      recipe: value('Chowder'),
    });

    expect(getRecipePendingEdits(4)).toEqual([
      expect.objectContaining({
        recipeId: 7,
        baseline: expect.objectContaining({ name: 'Soup' }),
        recipe: expect.objectContaining({ name: 'Chowder' }),
      }),
    ]);
  });

  it('ignores a recipe fetch that started before a local edit', () => {
    const revisionAtStart = readRecipeDetailRevision(7);
    bumpRecipeDetailRevision(7);

    const result = resolveStaleFetch(
      revisionAtStart,
      readRecipeDetailRevision(7),
      { name: 'Stew' },
      { name: 'Server' }
    );

    expect(result).toEqual({ name: 'Stew' });
  });
});
