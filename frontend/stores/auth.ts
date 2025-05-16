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

  const validateToken = async () => {
    if (!accessToken.value) {
      clearAuth();
      return false;
    }

    try {
      const response = await fetch('/api/auth/validate', {
        headers: {
          'Authorization': `Bearer ${accessToken.value}`
        }
      });

      if (!response.ok) {
        // If token is invalid, try to refresh
        if (response.status === 401 && refreshToken.value) {
          const refreshResponse = await fetch('/api/auth/refresh-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken: refreshToken.value })
          });

          if (refreshResponse.ok) {
            const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await refreshResponse.json();
            setAuth({
              user: user.value!,
              accessToken: newAccessToken,
              refreshToken: newRefreshToken
            });
            return true;
          }
        }
        clearAuth();
        return false;
      }

      const { user: userData } = await response.json();
      user.value = userData;
      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      // If we can't reach the API, keep the current auth state
      // This allows offline access
      return true;
    }
  };
  
  const initializeAuth = async () => {
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
    
    if (accessToken.value) {
      const isValid = await validateToken();
      if (!isValid) {
        clearAuth();
        router.push('/login');
      }
    }
  };
  
  const logout = () => {
    clearAuth();
    router.push('/login');
  };
  
  // Initialize auth state
  initializeAuth();
  
  // Set up periodic token validation (every 5 minutes)
  if (import.meta.client) {
    setInterval(validateToken, 5 * 60 * 1000);
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
    initializeAuth,
    validateToken
  };
}); 