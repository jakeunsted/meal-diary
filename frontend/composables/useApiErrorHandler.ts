import { handleAutoLogout } from '~/composables/useAuth';

/**
 * Composable for handling API errors, specifically 401 errors that should trigger automatic logout
 */
export const useApiErrorHandler = () => {
  /**
   * Wraps an API call and handles 401 errors by triggering automatic logout
   * @param apiCall - The API call function to wrap
   * @returns The result of the API call, or throws an error if it's not a 401
   */
  const withErrorHandling = async <T>(apiCall: () => Promise<T>): Promise<T> => {
    try {
      return await apiCall();
    } catch (error: any) {
      // Check if it's a 401 error
      if (error?.statusCode === 401 || error?.status === 401 || 
          error?.data?.statusCode === 401 || error?.response?.status === 401) {
        console.log('[API Error Handler] 401 error detected, triggering automatic logout');
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