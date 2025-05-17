import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
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
  const setAuth = (authData: { user: User; accessToken: string; refreshToken: string }) => {
    user.value = authData.user;
    accessToken.value = authData.accessToken;
    refreshToken.value = authData.refreshToken;
    
    // Save to localStorage
    if (import.meta.client) {
      const authState: AuthState = {
        user: authData.user,
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
        isAuthenticated: true
      };
      localStorage.setItem('authState', JSON.stringify(authState));
    }
  };
  
  const clearAuth = () => {
    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
    
    // Clear localStorage
    if (import.meta.client) {
      localStorage.removeItem('authState');
    }
  };
  
  const initializeAuth = () => {
    if (import.meta.client) {
      const storedAuth = localStorage.getItem('authState');
      if (storedAuth) {
        try {
          const authState: AuthState = JSON.parse(storedAuth);
          user.value = authState.user;
          accessToken.value = authState.accessToken;
          refreshToken.value = authState.refreshToken;
        } catch (error) {
          console.error('Failed to parse stored auth data:', error);
          clearAuth();
        }
      }
    }
  };
  
  const logout = () => {
    clearAuth();
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