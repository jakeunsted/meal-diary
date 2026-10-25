import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { browserStorage } from '~/utils/browserStorage';
import type { User } from '../types/User';
import type { ResolvedEntitlements } from '../types/Entitlements';
import { hasFamilyGroup } from '~/composables/useAuth';
import { isTokenExpired } from '~/composables/useJWT';
import { isSessionExpiredError } from '~/utils/httpError';
import { runWithTokenRefreshLock } from '~/utils/tokenRefresh';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

let initializeAuthPromise: Promise<void> | null = null;
let authStorageListenerRegistered = false;

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter();
  
  // State
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  
  // Getters
  const isAuthenticated = computed(() => !!accessToken.value);
  
  // Actions
  const setAuth = async (authData: {
    user: User;
    accessToken: string;
    refreshToken: string;
    entitlements?: ResolvedEntitlements | null;
  }) => {
    console.log('[Auth Store] Setting auth data:', { 
      hasUser: !!authData.user,
      hasAccessToken: !!authData.accessToken,
      hasRefreshToken: !!authData.refreshToken,
      userId: authData.user?.id,
      userEmail: authData.user?.email,
      family_group_id: authData.user?.family_group_id,
      hasFamilyGroup: hasFamilyGroup(authData.user)
    });
    
    user.value = authData.user;
    accessToken.value = authData.accessToken;
    refreshToken.value = authData.refreshToken;

    if (authData.entitlements) {
      useSubscriptionStore().setEntitlements(authData.entitlements);
    }
    
    // Identify user in PostHog (must match backend distinct_id format)
    if (import.meta.client && authData.user?.id) {
      try {
        const { $posthog } = useNuxtApp();
        if ($posthog && typeof ($posthog as any).identify === 'function') {
          ($posthog as any).identify(authData.user.id.toString(), {
            email: authData.user.email,
            name: `${authData.user.first_name} ${authData.user.last_name}`,
          });
        }
      } catch (error) {
        console.warn('[Auth Store] Failed to identify user in PostHog:', error);
      }
    }
    
    // Save to browser storage
    if (import.meta.client) {
      const authState: AuthState = {
        user: authData.user,
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
        isAuthenticated: true
      };
      console.log('[Auth Store] Saving auth state to storage:', {
        hasUser: !!authState.user,
        userId: authState.user?.id,
        family_group_id: authState.user?.family_group_id,
        hasFamilyGroup: hasFamilyGroup(authState.user)
      });
      browserStorage.set('authState', JSON.stringify(authState));
    }
  };
  
  const clearAuth = async () => {
    console.log('[Auth Store] Clearing auth data');
    
    // Reset PostHog user identification
    if (import.meta.client) {
      try {
        const { $posthog } = useNuxtApp();
        if ($posthog && typeof ($posthog as any).reset === 'function') {
          ($posthog as any).reset();
        }
      } catch (error) {
        console.warn('[Auth Store] Failed to reset PostHog:', error);
      }
    }
    
    // Clear state first
    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
    
    // Then clear storage
    if (import.meta.client) {
      console.log('[Auth Store] Removing auth state from storage');
      for (const key of [
        'authState',
        'mealDiary',
        'shoppingList',
        'userData',
        'family_members',
        'family_group',
        'family_members_last_fetched',
        'family_group_last_fetched',
        'entitlements',
        'entitlements_last_fetched',
      ]) {
        browserStorage.remove(key);
      }
      useSubscriptionStore().clearCache();
    }
  };
  
  const initializeAuth = async () => {
    if (!import.meta.client) return;

    if (initializeAuthPromise) {
      await initializeAuthPromise;
      return;
    }

    initializeAuthPromise = (async () => {
    try {
      console.log('[Auth Store] Initializing auth state from storage');
      const value = browserStorage.get('authState');
      if (value) {
        const authState: AuthState = JSON.parse(value);
        console.log('[Auth Store] Found stored auth state:', {
          hasUser: !!authState.user,
          hasAccessToken: !!authState.accessToken,
          hasRefreshToken: !!authState.refreshToken,
          userId: authState.user?.id,
          userEmail: authState.user?.email,
          family_group_id: authState.user?.family_group_id,
          hasFamilyGroup: hasFamilyGroup(authState.user),
        });
        // Only restore if we have all required data
        if (authState.user && authState.accessToken && authState.refreshToken) {
          if (isTokenExpired(authState.refreshToken, 0)) {
            console.log('[Auth Store] Refresh token expired, clearing stale auth state');
            await clearAuth();
            return;
          }

          user.value = authState.user;
          accessToken.value = authState.accessToken;
          refreshToken.value = authState.refreshToken;
          console.log('[Auth Store] Successfully restored auth state');

          // Proactively refresh an expired access token so the first API call
          // after returning from background doesn't hit a stale-token round-trip.
          if (isTokenExpired(authState.accessToken, 0)) {
            try {
              await runWithTokenRefreshLock(async () => {
                const { useAuth } = await import('~/composables/useAuth');
                const { refreshTokens } = useAuth();
                await refreshTokens();
              });
            } catch (err: unknown) {
              if (isSessionExpiredError(err)) {
                // Refresh can 403 when another request already rotated tokens.
                if (!accessToken.value || isTokenExpired(accessToken.value, 0)) {
                  await clearAuth();
                }
              }
              // Network/transient failure — keep the session; useApi will retry on next request.
            }
          }
          
          // Identify user in PostHog after restoring auth state
          if (authState.user?.id) {
            try {
              const { $posthog } = useNuxtApp();
              if ($posthog && typeof ($posthog as any).identify === 'function') {
                ($posthog as any).identify(authState.user.id.toString(), {
                  email: authState.user.email,
                  name: `${authState.user.first_name} ${authState.user.last_name}`,
                });
              }
            } catch (error) {
              console.warn('[Auth Store] Failed to identify user in PostHog:', error);
            }
          }
        } else {
          console.log('[Auth Store] Incomplete auth state, clearing');
          // If data is incomplete, clear it
          await clearAuth();
        }
      } else {
        console.log('[Auth Store] No stored auth state found');
      }
    } catch (error) {
      console.error('[Auth Store] Failed to initialize auth state:', error);
      await clearAuth();
    }
    })();

    try {
      await initializeAuthPromise;
    } finally {
      initializeAuthPromise = null;
    }
  };
  
  let logoutInProgress = false;

  const logout = async () => {
    if (logoutInProgress) {
      await clearAuth();
      return;
    }
    logoutInProgress = true;
    try {
      if (import.meta.client) {
        try {
          const { useMealDiaryStore } = await import('~/stores/mealDiary');
          await useMealDiaryStore().flushPending();
        } catch (error) {
          console.error('[Auth Store] Failed to flush meal diary before logout:', error);
        }
      }
      await clearAuth();
    } finally {
      logoutInProgress = false;
    }
  };

  /**
   * Handles automatic logout when token refresh fails
   * This method clears auth state and can be called from error handlers
   */
  const autoLogout = async () => {
    console.log('[Auth Store] Performing automatic logout due to failed token refresh');
    await clearAuth();
  };

  const setAccessToken = async (token: string) => {
    accessToken.value = token;
    // update authState
    if (import.meta.client) {
      const authState: AuthState = JSON.parse(browserStorage.get('authState') || '{}');
      authState.accessToken = token;
      browserStorage.set('authState', JSON.stringify(authState));
    }
  };

  const setRefreshToken = async (token: string) => {
    refreshToken.value = token;
    // update authState
    if (import.meta.client) {
      const authState: AuthState = JSON.parse(browserStorage.get('authState') || '{}');
      authState.refreshToken = token;
      browserStorage.set('authState', JSON.stringify(authState));
    }
  };

  /**
   * Family live updates must not carry session tokens. Ignore any payload
   * so a forged event cannot replace the stored session.
   */
  const updateTokensFromSSE = async (_tokens?: unknown) => {
    return;
  };

  /**
   * Apply auth written by another tab. The storage event does not fire in the
   * tab that wrote the value, so this does not write localStorage again.
   */
  const applyExternalAuthState = (raw: string | null) => {
    if (!raw) {
      user.value = null;
      accessToken.value = null;
      refreshToken.value = null;
      return;
    }

    try {
      const authState: AuthState = JSON.parse(raw);
      if (!authState.user || !authState.accessToken || !authState.refreshToken) {
        return;
      }
      if (isTokenExpired(authState.refreshToken, 0)) {
        return;
      }
      user.value = authState.user;
      accessToken.value = authState.accessToken;
      refreshToken.value = authState.refreshToken;
    } catch (error) {
      console.error('[Auth Store] Failed to apply auth state from another tab:', error);
    }
  };

  if (import.meta.client && !authStorageListenerRegistered && typeof window !== 'undefined') {
    authStorageListenerRegistered = true;
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key !== 'authState') {
        return;
      }
      useAuthStore().applyExternalAuthState(event.newValue);
    });
  }
  
  return {
    // State
    user,
    accessToken,
    refreshToken,
    
    // Getters
    isAuthenticated,
    
    // Actions
    setAuth,
    clearAuth,
    logout,
    autoLogout,
    initializeAuth,
    setAccessToken,
    setRefreshToken,
    updateTokensFromSSE,
    applyExternalAuthState
  };
}); 