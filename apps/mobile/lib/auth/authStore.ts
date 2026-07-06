import { create } from 'zustand';

import { apiFetch, ApiError } from '@/lib/api/client';
import { queryClient } from '@/lib/api/queryClient';
import { clearTokens, getRefreshToken, setTokens } from '@/lib/auth/tokenStorage';
import type { AuthResponse, ResolvedEntitlements, User } from '@/types/api';

type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  entitlements: ResolvedEntitlements | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Restore the session from the stored refresh token on app launch. */
  hydrate: () => Promise<void>;
  setUser: (user: User) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  entitlements: null,

  login: async (email, password) => {
    const response = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    await setTokens(response.accessToken, response.refreshToken);
    set({
      status: 'signedIn',
      user: response.user,
      entitlements: response.entitlements ?? null,
    });
  },

  logout: async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort server logout — always clear the local session
    }
    await clearTokens();
    queryClient.clear();
    set({ status: 'signedOut', user: null, entitlements: null });
  },

  hydrate: async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        set({ status: 'signedOut' });
        return;
      }

      const response = await apiFetch<AuthResponse>('/auth/refresh-token', {
        method: 'POST',
        body: { refreshToken },
        auth: false,
      });
      await setTokens(response.accessToken, response.refreshToken);
      set({
        status: 'signedIn',
        user: response.user,
        entitlements: response.entitlements ?? null,
      });
    } catch (error) {
      // Network failures shouldn't wipe tokens; invalid tokens should
      if (error instanceof ApiError) {
        await clearTokens();
      }
      set({ status: 'signedOut', user: null, entitlements: null });
    }
  },

  setUser: (user) => set({ user }),

  clearSession: () => {
    queryClient.clear();
    set({ status: 'signedOut', user: null, entitlements: null });
  },
}));
