import { handleAutoLogout } from '~/composables/useAuth';

/**
 * Extract error message from various error formats
 */
const extractErrorMessage = (error: any): string => {
  if (error?.data?.message && typeof error.data.message === 'string') {
    return error.data.message;
  }
  if (error?.response?.data?.message && typeof error.response.data.message === 'string') {
    return error.response.data.message;
  }
  if (error?.message && typeof error.message === 'string') {
    return error.message;
  }
  return '';
};

/**
 * Check if an error is an authentication error based on status code or message
 */
const isAuthError = (error: any): boolean => {
  // Check status codes (401, 403)
  if (error?.statusCode === 401 || error?.statusCode === 403 ||
      error?.status === 401 || error?.status === 403 ||
      error?.data?.statusCode === 401 || error?.data?.statusCode === 403 ||
      error?.response?.status === 401 || error?.response?.status === 403) {
    return true;
  }
  
  // Check for auth-related error messages (even in 500 errors)
  const errorMessage = extractErrorMessage(error);
  if (!errorMessage) {
    return false;
  }
  
  const authErrorMessages = [
    'Invalid or expired refresh token',
    'Failed to refresh token',
    'Token refresh failed',
    'Unauthorized',
    'Forbidden',
    'Invalid token',
    'Expired token',
    'No token provided'
  ];
  
  const lowerMessage = errorMessage.toLowerCase();
  return authErrorMessages.some(msg => lowerMessage.includes(msg.toLowerCase()));
};

/**
 * Composable for handling API errors, specifically authentication errors that should trigger automatic logout
 */
export const useApiErrorHandler = () => {
  /**
   * Wraps an API call and handles authentication errors by triggering automatic logout
   * @param apiCall - The API call function to wrap
   * @returns The result of the API call, or throws an error if it's not an auth error
   */
  const withErrorHandling = async <T>(apiCall: () => Promise<T>): Promise<T> => {
    try {
      return await apiCall();
    } catch (error: any) {
      // Check if it's an authentication error (by status code or message)
      if (isAuthError(error)) {
        console.log('[API Error Handler] Authentication error detected, triggering automatic logout');
        await handleAutoLogout();
      }
      
      // Re-throw the error for other error handling
      throw error;
    }
  };

  /**
   * Creates a wrapper for $fetch that handles 401 errors
   * @param url - The URL to fetch
   * @param options - The fetch options
   * @returns The fetch result
   */
  const safeFetch = async <T>(url: string, options?: any): Promise<T> => {
    return withErrorHandling(() => $fetch<T>(url, options));
  };

  return {
    withErrorHandling,
    safeFetch
  };
}; 