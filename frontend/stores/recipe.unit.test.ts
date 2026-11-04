import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Recipe } from '~/types/Recipe';

const api = vi.fn();

vi.mock('~/utils/browserStorage', () => ({
  browserStorage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('~/composables/useApi', () => ({
  useApi: () => ({ api }),
}));

vi.mock('~/composables/useToast', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

vi.mock('~/composables/usePaywall', () => ({
  usePaywall: () => ({ openPaywall: vi.fn() }),
}));

import { useRecipeStore } from './recipe';
import { useUserStore } from './user';

const recipe = (name: string): Recipe => ({
  id: 7,
  family_group_id: 9,
  created_by: 3,
  name,
  description: null,
  instructions: 'Simmer',
  portions: 2,
  ingredients: [{ name: 'Onion', quantity: 1, unit: null }],
  categories: [],
});

describe('recipe store offline edits', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.mockReset();
    useUserStore().user = { id: 3, family_group_id: 9 } as never;
  });

  it('keeps the first baseline and shows the edited recipe', async () => {
    const store = useRecipeStore();
    store.recipes = [recipe('Soup')];
    store.currentRecipe = recipe('Soup');
    const baseline = {
      name: 'Soup',
      description: null,
      instructions: 'Simmer',
      portions: 2,
      ingredients: [{ name: 'Onion', quantity: 1, unit: null }],
      category_ids: [],
    };

    await store.queueRecipeEdit(7, baseline, { ...baseline, name: 'Stew' });
    await store.queueRecipeEdit(7, { ...baseline, name: 'Stew' }, { ...baseline, name: 'Chowder' });

    expect(store.pendingEdits).toEqual([
      expect.objectContaining({
        recipeId: 7,
        baseline: expect.objectContaining({ name: 'Soup' }),
        recipe: expect.objectContaining({ name: 'Chowder' }),
      }),
    ]);
    expect(store.currentRecipe?.name).toBe('Chowder');
  });

  it('ignores a recipe fetch that started before a local edit', async () => {
    let finish: (value: Recipe) => void = () => undefined;
    api.mockReturnValue(new Promise((resolve) => {
      finish = resolve;
    }));
    const store = useRecipeStore();
    store.recipes = [recipe('Soup')];
    store.currentRecipe = recipe('Soup');
    const baseline = {
      name: 'Soup',
      description: null,
      instructions: 'Simmer',
      portions: 2,
      ingredients: [{ name: 'Onion', quantity: 1, unit: null }],
      category_ids: [],
    };

    const pending = store.fetchRecipeById(7);
    await store.queueRecipeEdit(7, baseline, { ...baseline, name: 'Stew' });
    finish(recipe('Server'));
    await pending;

    expect(store.currentRecipe?.name).toBe('Stew');
  });
});
