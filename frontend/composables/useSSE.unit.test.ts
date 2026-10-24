import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const isAuthenticated = ref(false);
const currentRoute = ref({ path: '/diary' });
const handlers = vi.hoisted(() => ({
  setup: vi.fn(),
  close: vi.fn(),
}));
const authStore = {
  isAuthenticated,
  user: { id: 5, family_group_id: 9 } as { id: number; family_group_id?: number } | null,
  updateTokensFromSSE: vi.fn(),
};
const items: Array<{ id: number; checked?: boolean; category?: string; position?: number }> = [];
const shoppingListStore = {
  shoppingList: { items },
  fetchShoppingList: vi.fn(),
  saveToLocalStorage: vi.fn(),
};
const mealDiaryStore = {
  hydrateFromStorage: vi.fn(),
  handleDailyMealUpdate: vi.fn(),
  fetchWeeklyMeals: vi.fn(),
  updateMealsFromEvents: vi.fn(),
  currentWeekStart: '2026-10-19',
};
const userStore = {
  user: { family_group_id: 9 } as { family_group_id?: number } | null,
  loadFromStorage: vi.fn(),
  fetchUser: vi.fn(),
};

vi.mock('~/stores/auth', () => ({ useAuthStore: () => authStore }));
vi.mock('~/stores/shoppingList', () => ({ useShoppingListStore: () => shoppingListStore }));
vi.mock('~/stores/mealDiary', () => ({ useMealDiaryStore: () => mealDiaryStore }));
vi.mock('~/stores/user', () => ({ useUserStore: () => userStore }));

import { useSSE } from './useSSE';

describe('useSSE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    items.splice(0, items.length);
    isAuthenticated.value = false;
    currentRoute.value = { path: '/diary' };
    authStore.user = { id: 5, family_group_id: 9 };
    userStore.user = { family_group_id: 9 };
    handlers.setup.mockReturnValue({} as EventSource);
    vi.stubGlobal('useNuxtApp', () => ({ $sse: handlers }));
    vi.stubGlobal('useRouter', () => ({ currentRoute }));
  });

  it('applies another person\'s shopping and diary events and ignores its own', async () => {
    let captured: Record<string, (data: unknown) => void> = {};
    handlers.setup.mockImplementation((_id: number, next: Record<string, (data: unknown) => void>) => {
      captured = next;
      return {} as EventSource;
    });
    isAuthenticated.value = true;

    useSSE().initializeSSE();
    await vi.waitFor(() => expect(handlers.setup).toHaveBeenCalledWith(9, expect.any(Object)));

    captured['add-item']({ actorUserId: 5, item: { id: 1 } });
    expect(items).toHaveLength(0);

    captured['add-item']({ actorUserId: 8, item: { id: 1, checked: false } });
    expect(items).toEqual([{ id: 1, checked: false }]);
    captured['check-item']({ actorUserId: 8, item: { id: 1 } });
    expect(items[0].checked).toBe(true);
    captured['move-item']({ actorUserId: 8, item: { id: 1, category: 'dairy', position: 2 } });
    expect(items[0]).toEqual(expect.objectContaining({ category: 'dairy', position: 2 }));
    captured['delete-item']({ actorUserId: 8, item: { id: 1 } });
    expect(shoppingListStore.shoppingList.items).toHaveLength(0);
    expect(shoppingListStore.saveToLocalStorage).toHaveBeenCalled();

    captured['update-daily-meal']({ dailyMeal: { day_of_week: 1 } });
    captured['meal-slots-updated']({});
    captured.initial({ mealDiary: [{ day_of_week: 1 }] });
    expect(mealDiaryStore.handleDailyMealUpdate).toHaveBeenCalledWith({ day_of_week: 1 });
    expect(mealDiaryStore.updateMealsFromEvents).toHaveBeenCalled();
  });

  it('does not connect on registration and closes when the session ends', async () => {
    currentRoute.value = { path: '/registration/step-2' };
    isAuthenticated.value = true;
    const sse = useSSE();
    sse.initializeSSE();
    await Promise.resolve();
    expect(handlers.setup).not.toHaveBeenCalled();

    currentRoute.value = { path: '/diary' };
    isAuthenticated.value = false;
    sse.initializeSSE();
    await Promise.resolve();
    expect(handlers.close).not.toHaveBeenCalled();
  });
});
