import { ref } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useRouter } from 'vue-router';
import { useApi } from '~/composables/useApi';

/**
 * Interface for the authentication response.
 * @property {Object} user - The user object containing id, email, username, and optional firstName and lastName.
 * @property {string} accessToken - The access token for authentication.
 * @property {string} refreshToken - The refresh token for token refresh.
 */
interface AuthResponse {
  user: {
    id: number;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
    family_group_id?: number;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Interface for the token response.
 * @property {string} accessToken - The access token for authentication.
 * @property {string} refreshToken - The refresh token for token refresh.
 */
interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * Utility function to check if a user has a family group
 * @param {any} user - The user object to check
 * @returns {boolean} True if the user has a family group, false otherwise
 */
export const hasFamilyGroup = (user: any): boolean => {
  return user?.family_group_id != null && user.family_group_id !== undefined;
};

/**
 * Handles automatic logout when token refresh fails
 * This function clears auth state and redirects to login
 */
export const handleAutoLogout = async () => {
  console.log('[Auto Logout] Handling automatic logout due to failed token refresh');
  
  const authStore = useAuthStore();
  
  try {
    // Clear auth state
    await authStore.logout();
    
    // Try to use router if available, otherwise use window.location
    if (import.meta.client) {
      try {
        const router = useRouter();
        if (router && router.push) {
          await router.push('/login');
          console.log('[Auto Logout] Successfully logged out and redirected to login');
          return;
        }
      } catch (routerError) {
        console.warn('[Auto Logout] Router not available, using window.location:', routerError);
      }
      
      // Fallback: force page reload to login
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('[Auto Logout] Error during automatic logout:', error);
    // Final fallback: force page reload to login
    if (import.meta.client) {
      window.location.href = '/login';
    }
  }
};

/**
 * Composable function for handling authentication.
 * @returns An object containing login, logout, refreshTokens, isLoading, error, isAuthenticated, and user properties.
 */
export const useAuth = () => {
  const authStore = useAuthStore();
  const router = useRouter();
  
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  
  /**
   * Logs in a user with the provided email and password.
   * @param {string} email - The user's email.
   * @param {string} password - The user's password.
   * @returns {Promise<AuthResponse>} A promise that resolves to the authentication response.
   */
  const login = async (email: string, password: string) => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const { api } = useApi();
      const response = await api<AuthResponse & { redirect?: string }>('/api/auth/login', {
        method: 'POST',
        body: {
          email,
          password
        }
      });
      
      // Log response data for debugging
      console.log('[useAuth] Login response:', {
        hasUser: !!response.user,
        userId: response.user?.id,
        userEmail: response.user?.email,
        family_group_id: response.user?.family_group_id,
        hasFamilyGroup: !!response.user?.family_group_id,
        hasAccessToken: !!response.accessToken,
        hasRefreshToken: !!response.refreshToken
      });
      
      // Only store auth data if we have a valid response with tokens
      if (response && response.accessToken && response.refreshToken) {
        authStore.setAuth(response);
        
        // Determine redirect based on family group status
        if (!hasFamilyGroup(response.user)) {
          console.log('[useAuth] No family group, redirecting to step-2');
          response.redirect = '/registration/step-2';
        } else {
          console.log('[useAuth] Has family group, redirecting to diary');
          response.redirect = '/diary';
        }
        return response;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      error.value = err.data?.message || 'Login failed. Please try again.';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };
  
  /**
   * Logs out the current user.
   */
  const logout = async () => {
    try {
      isLoading.value = true;
      error.value = null;
      
      // Call logout endpoint if we have a token
      if (authStore.accessToken) {
        const { api } = useApi();
        await api('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.accessToken}`
          }
        });
      }

      // remove values from local storage
      localStorage.removeItem('auth');
      
      // Clear auth state
      authStore.logout();
    } catch (err: any) {
      error.value = err.data?.message || 'Logout failed.';
      console.error('Logout error:', err);
    } finally {
      isLoading.value = false;
    }
  };
  
  /**
   * Refreshes the user's tokens.
   * @returns {Promise<TokenResponse>} A promise that resolves to the token response.
   */
  const refreshTokens = async () => {
    try {
      if (!authStore.refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const { api } = useApi();
      const response = await api<TokenResponse>('/api/auth/refresh-token', {
        method: 'POST',
        body: {
          refreshToken: authStore.refreshToken
        }
      });
      
      // Update tokens in store
      authStore.setAuth({
        user: authStore.user!,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });
      
      return response;
    } catch (err: any) {
      // If refresh fails, trigger automatic logout
      console.log('[useAuth] Token refresh failed, triggering automatic logout');
      await handleAutoLogout();
      throw err;
    }
  };
  
  return {
    login,
    logout,
    refreshTokens,
    isLoading,
    error,
    isAuthenticated: authStore.isAuthenticated,
    user: authStore.user
  };
}; 