import { create } from 'zustand';

import { identifyUser, resetAnalytics } from '@/lib/analytics/posthog';
import { apiFetch } from '@/lib/api/client';
import { queryClient } from '@/lib/api/queryClient';
import { clearMealDiaryCache } from '@/lib/diary/mealDiaryStorage';
import { clearPendingQueue } from '@/lib/shopping-list/shoppingListPendingQueue';
import { clearShoppingListCache } from '@/lib/shopping-list/shoppingListStorage';
import { isSessionExpiredError } from '@/lib/auth/httpError';
import { isTokenExpired } from '@/lib/auth/jwt';
import { refreshTokens } from '@/lib/auth/refreshTokens';
import { runWithTokenRefreshLock } from '@/lib/auth/tokenRefreshLock';
import { clearAuthState, getAuthState, getAccessToken, getRefreshToken, setAuthState } from '@/lib/auth/tokenStorage';
import type { AuthResponse, ResolvedEntitlements, User } from '@/types/api';

type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface SetAuthPayload {
  user: User;
  accessToken: string;
  refreshToken: string;
  entitlements?: ResolvedEntitlements | null;
}

interface AuthState {
  status: AuthStatus;
  user: User | null;
  entitlements: ResolvedEntitlements | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  setAuth: (authData: SetAuthPayload) => Promise<void>;
  setUser: (user: User) => void;
  clearSession: () => Promise<void>;
}

let initializeAuthPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  entitlements: null,

  setAuth: async (authData) => {
    await setAuthState({
      user: authData.user,
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken,
      entitlements: authData.entitlements ?? null,
    });
    set({
      status: 'signedIn',
      user: authData.user,
      entitlements: authData.entitlements ?? null,
    });
    identifyUser(authData.user);
  },

  login: async (email, password) => {
    const response = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    await get().setAuth({
      user: response.user,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      entitlements: response.entitlements ?? null,
    });
  },

  logout: async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort server logout — always clear the local session
    }
    await get().clearSession();
  },

  initializeAuth: async () => {
    if (initializeAuthPromise) {
      await initializeAuthPromise;
      return;
    }

    initializeAuthPromise = (async () => {
      try {
        let stored = await getAuthState();

        // Legacy sessions may only have token keys — refresh once to populate authState
        if (!stored?.user) {
          const legacyAccess = await getAccessToken();
          const legacyRefresh = await getRefreshToken();
          if (legacyAccess && legacyRefresh && !isTokenExpired(legacyRefresh, 0)) {
            try {
              await runWithTokenRefreshLock(async () => {
                const response = await refreshTokens();
                set({
                  status: 'signedIn',
                  user: response.user,
                  entitlements: response.entitlements ?? null,
                });
                identifyUser(response.user);
              });
              return;
            } catch (error) {
              if (isSessionExpiredError(error)) {
                await clearAuthState();
                set({ status: 'signedOut', user: null, entitlements: null });
              }
              return;
            }
          }
          set({ status: 'signedOut', user: null, entitlements: null });
          return;
        }

        if (!stored.accessToken || !stored.refreshToken) {
          set({ status: 'signedOut', user: null, entitlements: null });
          return;
        }

        if (isTokenExpired(stored.refreshToken, 0)) {
          await clearAuthState();
          set({ status: 'signedOut', user: null, entitlements: null });
          return;
        }

        set({
          status: 'signedIn',
          user: stored.user,
          entitlements: stored.entitlements ?? null,
        });
        identifyUser(stored.user);

        if (isTokenExpired(stored.accessToken, 0)) {
          try {
            await runWithTokenRefreshLock(async () => {
              const response = await refreshTokens();
              set({
                status: 'signedIn',
                user: response.user,
                entitlements: response.entitlements ?? null,
              });
              identifyUser(response.user);
            });
          } catch (error) {
            if (isSessionExpiredError(error)) {
              const latest = await getAuthState();
              if (!latest?.accessToken || isTokenExpired(latest.accessToken, 0)) {
                await clearAuthState();
                set({ status: 'signedOut', user: null, entitlements: null });
              }
            }
            // Network/transient failure — keep restored session
          }
        }
      } catch {
        await clearAuthState();
        set({ status: 'signedOut', user: null, entitlements: null });
      }
    })();

    try {
      await initializeAuthPromise;
    } finally {
      initializeAuthPromise = null;
    }
  },

  setUser: (user) => set({ user }),

  clearSession: async () => {
    await clearMealDiaryCache();
    await clearShoppingListCache();
    await clearPendingQueue();
    await clearAuthState();
    queryClient.clear();
    resetAnalytics();
    set({ status: 'signedOut', user: null, entitlements: null });
  },
}));
