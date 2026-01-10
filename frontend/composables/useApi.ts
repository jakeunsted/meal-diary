import type { FetchOptions } from 'ofetch';
import { useToast } from '~/composables/useToast';
import { handleAutoLogout } from '~/composables/useAuth';
import { useAuthStore } from '~/stores/auth';
import { isTokenExpired } from '~/composables/useJWT';
import { useAuth } from '~/composables/useAuth';

/**
 * Extract error message from various error formats
 */
const extractErrorMessage = (error: any): string => {
  // Priority 1: Direct API response message (from apiFetch in server/utils/fetch.ts)
  // This is the message from the actual API response body
  if (error?.data?.message && typeof error.data.message === 'string') {
    return error.data.message;
  }

  // Priority 2: Nuxt $fetch wrapped response (when error comes from server API route)
  if (error?.response?.data?.message && typeof error.response.data.message === 'string') {
    return error.response.data.message;
  }

  // Priority 3: Direct string message in data
  if (error?.data && typeof error.data === 'string') {
    return error.data;
  }

  // Priority 4: Check if data is an object with message property (alternative structure)
  if (error?.data && typeof error.data === 'object' && error.data !== null) {
    if (error.data.message && typeof error.data.message === 'string') {
      return error.data.message;
    }
  }

  // Priority 5: Generic error message (but skip generic ones)
  if (error?.message && typeof error.message === 'string') {
    // Skip generic messages like "fetch failed" - these don't help the user
    const genericMessages = ['fetch failed', 'Network request failed', 'Failed to fetch'];
    if (genericMessages.includes(error.message)) {
      // For generic messages, try to get more specific info
      // Check if there's a response body we can parse
      if (error?.response?._data) {
        const responseData = error.response._data;
        if (responseData?.message && typeof responseData.message === 'string') {
          return responseData.message;
        }
      }
      // Fall through to status code based message
      if (error.statusCode) {
        return getDefaultMessage(error.statusCode);
      }
      if (error.statusMessage && error.statusMessage !== 'Server Error') {
        return error.statusMessage;
      }
    }
    // If it's not a generic message, use it
    return error.message;
  }

  // Priority 6: HTTP status message (if not generic)
  if (error?.statusMessage && typeof error.statusMessage === 'string' && error.statusMessage !== 'Server Error') {
    return error.statusMessage;
  }

  // Priority 7: Default message based on status code
  if (error?.statusCode) {
    return getDefaultMessage(error.statusCode);
  }

  // Final fallback
  return 'An error occurred';
};

/**
 * Get default error message based on status code
 */
const getDefaultMessage = (statusCode: number): string => {
  switch (statusCode) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 500:
      return 'Server Error';
    case 502:
      return 'Bad Gateway';
    case 503:
      return 'Service Unavailable';
    default:
      return `Server Error (${statusCode})`;
  }
};

/**
 * Check if an error is an authentication error based on status code or message
 * Note: 403 might not always be an auth error - could be permission-based
 */
const isAuthError = (error: any, errorMessage: string): boolean => {
  // 401 is always an auth error
  if (error?.statusCode === 401 || error?.status === 401) {
    return true;
  }
  
  // 403 might be auth or permission - check the message
  if (error?.statusCode === 403 || error?.status === 403) {
    const lowerMessage = errorMessage.toLowerCase();
    const authRelatedMessages = [
      'invalid token',
      'expired token',
      'no token provided',
      'unauthorized',
      'token refresh failed',
      'failed to refresh token',
      'invalid or expired refresh token'
    ];
    // Only treat 403 as auth error if the message indicates token issues
    return authRelatedMessages.some(msg => lowerMessage.includes(msg));
  }
  
  // Check for auth-related error messages (even in 500 errors)
  const authErrorMessages = [
    'Invalid or expired refresh token',
    'Failed to refresh token',
    'Token refresh failed',
    'Invalid token',
    'Expired token',
    'No token provided'
  ];
  
  const lowerMessage = errorMessage.toLowerCase();
  return authErrorMessages.some(msg => lowerMessage.includes(msg.toLowerCase()));
};

// Flag to prevent recursive refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

/**
 * Composable for making API calls with automatic error handling
 * Wraps $fetch and automatically shows error toasts
 */
export const useApi = () => {
  const { showError } = useToast();
  const authStore = useAuthStore();
  const { refreshTokens } = useAuth();

  /**
   * Make an API call with automatic error handling
   * Automatically adds authentication headers if available
   * Checks token expiration and refreshes if needed before making requests
   * @param url - The URL to fetch
   * @param options - Fetch options
   * @returns The response data
   */
  const api = async <T = any>(url: string, options?: FetchOptions): Promise<T> => {
    try {
      // Skip token expiration check if this is the refresh endpoint itself
      const isRefreshEndpoint = url.includes('/auth/refresh-token');
      
      // Check if access token is expired and refresh if needed (client-side check)
      if (!isRefreshEndpoint && authStore.accessToken && authStore.refreshToken) {
        if (isTokenExpired(authStore.accessToken)) {
          // If refresh is already in progress, wait for it to complete
          if (isRefreshing && refreshPromise) {
            try {
              await refreshPromise;
            } catch (refreshError: any) {
              console.error('[useApi] Refresh failed while waiting:', refreshError);
              await handleAutoLogout();
              throw refreshError;
            }
          } else if (!isRefreshing) {
            // Start refresh
            isRefreshing = true;
            refreshPromise = (async () => {
              try {
                await refreshTokens();
              } catch (refreshError: any) {
                console.error('[useApi] Failed to refresh token:', refreshError);
                await handleAutoLogout();
                throw refreshError;
              } finally {
                isRefreshing = false;
                refreshPromise = null;
              }
            })();
            
            // Wait for refresh to complete
            await refreshPromise;
          }
        }
      }

      // Automatically add auth headers if available and not already provided
      const existingHeaders = options?.headers;
      const headers: Record<string, string> = {};

      // Check if auth headers already exist
      let hasAuthHeader = false;
      let hasRefreshHeader = false;

      if (existingHeaders) {
        if (existingHeaders instanceof Headers) {
          hasAuthHeader = existingHeaders.has('Authorization') || existingHeaders.has('authorization');
          hasRefreshHeader = existingHeaders.has('x-refresh-token') || existingHeaders.has('X-Refresh-Token');
        } else if (Array.isArray(existingHeaders)) {
          hasAuthHeader = existingHeaders.some(([key]) => key.toLowerCase() === 'authorization');
          hasRefreshHeader = existingHeaders.some(([key]) => key.toLowerCase() === 'x-refresh-token');
        } else {
          const headerObj = existingHeaders as Record<string, string>;
          hasAuthHeader = !!(headerObj['Authorization'] || headerObj['authorization']);
          hasRefreshHeader = !!(headerObj['x-refresh-token'] || headerObj['X-Refresh-Token']);
        }
      }

      // Add auth headers if not present (use updated tokens after potential refresh)
      if (authStore.accessToken && !hasAuthHeader) {
        headers['Authorization'] = `Bearer ${authStore.accessToken}`;
      }
      if (authStore.refreshToken && !hasRefreshHeader) {
        headers['x-refresh-token'] = authStore.refreshToken;
      }

      // Merge headers
      const finalHeaders = Object.keys(headers).length > 0
        ? { ...(existingHeaders as Record<string, string> || {}), ...headers }
        : existingHeaders;

      return await $fetch(url, {
        ...options,
        headers: finalHeaders
      } as any) as T;
    } catch (error: any) {
      // Extract meaningful error message
      const errorMessage = extractErrorMessage(error);

      // Check if this is an authentication error (by status code or message)
      const isAuth = isAuthError(error, errorMessage);
      
      if (isAuth) {
        console.error('[useApi] Authentication error detected:', {
          url,
          statusCode: error.statusCode,
          message: errorMessage
        });
        await handleAutoLogout();
      } else {
        // Show error toast for non-auth errors
        showError(errorMessage);
      }

      // Re-throw the error so pages can still handle it if needed
      throw error;
    }
  };

  return {
    api
  };
};

