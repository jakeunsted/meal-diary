import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Preferences } from '@capacitor/preferences';
import type { User } from '../types/User';
import { hasFamilyGroup } from '~/composables/useAuth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter();
  
  // State
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  
  // Getters
  const isAuthenticated = computed(() => !!accessToken.value);
  
  // Actions
  const setAuth = async (authData: { user: User; accessToken: string; refreshToken: string }) => {
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
    
    // Save to Preferences
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
      await Preferences.set({
        key: 'authState',
        value: JSON.stringify(authState)
      });
    }
  };
  
  const clearAuth = async () => {
    console.log('[Auth Store] Clearing auth data');
    // Clear state first
    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
    
    // Then clear storage
    if (import.meta.client) {
      try {
        console.log('[Auth Store] Removing auth state from storage');
        await Preferences.remove({ key: 'authState' });
      } catch (error) {
        console.error('[Auth Store] Failed to clear auth state from storage:', error);
      }
      try {
        await Preferences.remove({ key: 'mealDiary' });
      } catch (error) {
        // zzz
      }
      try {
        await Preferences.remove({ key: 'shoppingList' });
      } catch (error) {
        // zzz
      }
    }
  };
  
  const initializeAuth = async () => {
    if (!import.meta.client) return;
    
    try {
      console.log('[Auth Store] Initializing auth state from storage');
      const { value } = await Preferences.get({ key: 'authState' });
      if (value) {
        const authState: AuthState = JSON.parse(value);
        console.log('[Auth Store] Found stored auth state:', {
          hasUser: !!authState.user,
          hasAccessToken: !!authState.accessToken,
          hasRefreshToken: !!authState.refreshToken,
          userId: authState.user?.id,
          userEmail: authState.user?.email,
          family_group_id: authState.user?.family_group_id,
          hasFamilyGroup: hasFamilyGroup(authState.user)
        });
        // Only restore if we have all required data
        if (authState.user && authState.accessToken && authState.refreshToken) {
          user.value = authState.user;
          accessToken.value = authState.accessToken;
          refreshToken.value = authState.refreshToken;
          console.log('[Auth Store] Successfully restored auth state');
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
  };
  
  const logout = async () => {
    await clearAuth();
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
      const authState: AuthState = JSON.parse(await Preferences.get({ key: 'authState' }).then(res => res.value || '{}'));
      authState.accessToken = token;
      await Preferences.set({
        key: 'authState',
        value: JSON.stringify(authState)
      });
    }
  };

  const setRefreshToken = async (token: string) => {
    refreshToken.value = token;
    // update authState
    if (import.meta.client) {
      const authState: AuthState = JSON.parse(await Preferences.get({ key: 'authState' }).then(res => res.value || '{}'));
      authState.refreshToken = token;
      await Preferences.set({
        key: 'authState',
        value: JSON.stringify(authState)
      });
    }
  };

  /**
   * Updates tokens from SSE events (when server refreshes tokens)
   * This method is called when the server emits a token-refresh event
   */
  const updateTokensFromSSE = async (tokens: { accessToken: string; refreshToken: string; userId: number }) => {
    // Validate input
    if (!tokens.accessToken || !tokens.refreshToken || !tokens.userId) {
      console.error('[Auth Store] Invalid token data received from SSE:', tokens);
      return;
    }

    // Only update if the tokens are for the current user
    if (user.value?.id !== tokens.userId) {
      return;
    }
    
    try {
      // Update store state
      accessToken.value = tokens.accessToken;
      refreshToken.value = tokens.refreshToken;
      
      // Update local storage
      if (import.meta.client) {
        const { value } = await Preferences.get({ key: 'authState' });
        if (value) {
          const authState: AuthState = JSON.parse(value);
          authState.accessToken = tokens.accessToken;
          authState.refreshToken = tokens.refreshToken;
          await Preferences.set({
            key: 'authState',
            value: JSON.stringify(authState)
          });
        }
      }
    } catch (error) {
      console.error('[Auth Store] Failed to update auth state from SSE:', error);
    }
  };
  
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
    updateTokensFromSSE
  };
}); 