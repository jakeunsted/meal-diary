import type { FetchOptions } from 'ofetch';
import { useToast } from '~/composables/useToast';

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
 * Composable for making API calls with automatic error handling
 * Wraps $fetch and automatically shows error toasts
 */
export const useApi = () => {
  const { showError } = useToast();

  /**
   * Make an API call with automatic error handling
   * @param url - The URL to fetch
   * @param options - Fetch options
   * @returns The response data
   */
  const api = async <T = any>(url: string, options?: FetchOptions): Promise<T> => {
    try {
      return await $fetch<T>(url, options as any);
    } catch (error: any) {
      // Extract meaningful error message
      const errorMessage = extractErrorMessage(error);

      // Show error toast (except for 401 which may trigger auto-logout)
      if (error?.statusCode !== 401) {
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

