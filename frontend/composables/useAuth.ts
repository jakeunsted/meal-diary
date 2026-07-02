import { ref } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useRouter } from 'vue-router';
import { useApi } from '~/composables/useApi';
import { isTokenExpired } from '~/composables/useJWT';
import { getHttpStatusCode } from '~/utils/httpError';
import type { ResolvedEntitlements } from '~/types/Entitlements';

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
  entitlements?: ResolvedEntitlements;
}

/**
 * Interface for the token response.
 * @property {string} accessToken - The access token for authentication.
 * @property {string} refreshToken - The refresh token for token refresh.
 */
interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user?: AuthResponse['user'];
  entitlements?: ResolvedEntitlements;
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
      
      // Only store auth data if we have a valid response with tokens
      if (response && response.accessToken && response.refreshToken) {
        authStore.setAuth(response);
        
        // Determine redirect based on family group status
        if (!hasFamilyGroup(response.user)) {
          response.redirect = '/registration/step-2';
        } else {
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
   * Uses $fetch directly to avoid recursion through useApi
   * @returns {Promise<TokenResponse>} A promise that resolves to the token response.
   */
  const refreshTokens = async () => {
    try {
      if (!authStore.refreshToken) {
        console.error('[Token Debug] refreshTokens: no refresh token in store');
        throw new Error('No refresh token available');
      }

      const refreshTokenUsed = authStore.refreshToken;
      console.log('[Token Debug] refreshTokens: calling /api/auth/refresh-token');
      
      // Use $fetch directly instead of useApi to prevent recursion
      // The refresh endpoint doesn't require an access token, only the refresh token in the body
      const response = await $fetch('/api/auth/refresh-token', {
        method: 'POST',
        body: {
          refreshToken: refreshTokenUsed
        }
      }) as TokenResponse;

      console.log('[Token Debug] refreshTokens: succeeded, updating store');
      
      // Update tokens in store
      authStore.setAuth({
        user: response.user ?? authStore.user!,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        entitlements: response.entitlements,
      });
      
      return response;
    } catch (err: any) {
      const statusCode = getHttpStatusCode(err);

      // Another caller (parallel tab, SSE, or a prior in-flight request) may have
      // already rotated the refresh token — don't treat that as session expiry.
      if (statusCode === 403 && authStore.accessToken && !isTokenExpired(authStore.accessToken, 0)) {
        console.warn('[Token Debug] refreshTokens: 403 but access token still valid — keeping session');
        return {
          accessToken: authStore.accessToken,
          refreshToken: authStore.refreshToken!,
          user: authStore.user ?? undefined,
        };
      }

      console.error('[Token Debug] refreshTokens: failed', {
        statusCode: err?.statusCode ?? err?.status ?? err?.data?.statusCode,
        message: err?.data?.message ?? err?.message,
        errorData: err?.data,
      });
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