import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Preferences } from '@capacitor/preferences';
import type { User } from '../types/User';

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
      await Preferences.set({
        key: 'authState',
        value: JSON.stringify(authState)
      });
    }
  };
  
  const clearAuth = async () => {
    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
    
    // Clear Preferences
    if (import.meta.client) {
      await Preferences.remove({ key: 'authState' });
    }
  };
  
  const initializeAuth = async () => {
    if (import.meta.client) {
      const { value } = await Preferences.get({ key: 'authState' });
      if (value) {
        try {
          const authState: AuthState = JSON.parse(value);
          user.value = authState.user;
          accessToken.value = authState.accessToken;
          refreshToken.value = authState.refreshToken;
        } catch (error) {
          console.error('Failed to parse stored auth data:', error);
          await clearAuth();
        }
      }
    }
  };
  
  const logout = async () => {
    await clearAuth();
    router.push('/login');
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
    initializeAuth
  };
}); 