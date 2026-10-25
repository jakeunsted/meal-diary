import { beforeEach, describe, expect, it, vi } from 'vitest';

const clearRegisterCode = vi.hoisted(() => vi.fn());

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

vi.mock('@/lib/auth/registerStorage', () => ({
  clearRegisterCode,
}));

vi.mock('@/lib/analytics/posthog', () => ({
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/api/queryClient', () => ({
  queryClient: { clear: vi.fn() },
}));

vi.mock('@/lib/billing/purchases', () => ({
  logOutPurchases: vi.fn(),
}));

vi.mock('@/lib/diary/mealDiaryPendingQueue', () => ({
  clearAllMealDiaryPendingQueues: vi.fn(),
}));

vi.mock('@/lib/diary/mealDiarySync', () => ({
  flushMealDiaryPending: vi.fn(),
  resetMealDiarySyncState: vi.fn(),
}));

vi.mock('@/lib/diary/mealDiaryStorage', () => ({
  clearMealDiaryCache: vi.fn(),
}));

vi.mock('@/lib/shopping-list/shoppingListPendingQueue', () => ({
  clearPendingQueue: vi.fn(),
}));

vi.mock('@/lib/shopping-list/shoppingListStorage', () => ({
  clearShoppingListCache: vi.fn(),
}));

vi.mock('@/lib/auth/tokenStorage', () => ({
  clearAuthState: vi.fn(),
  getAuthState: vi.fn(),
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  setAuthState: vi.fn(),
}));

import { useAuthStore } from '@/lib/auth/authStore';

describe('clearSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a stored family invite code', async () => {
    await useAuthStore.getState().clearSession();
    expect(clearRegisterCode).toHaveBeenCalledOnce();
  });
});
