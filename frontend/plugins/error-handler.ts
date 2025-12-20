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
      error?.status === 401 || error?.status === 403) {
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

export default defineNuxtPlugin(() => {
  // Handle global fetch errors
  if (process.client) {
    // Override the global fetch to catch authentication errors
    const originalFetch = window.fetch;
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
      try {
        const response = await originalFetch(input, init);
        
        // If we get a 401 or 403 response, trigger automatic logout
        if (response.status === 401 || response.status === 403) {
          console.log('[Global Error Handler] Authentication error detected (status: ' + response.status + '), triggering automatic logout');
          await handleAutoLogout();
        }
        
        return response;
      } catch (error) {
        console.error('[Global Error Handler] Fetch error:', error);
        throw error;
      }
    };
  }
  
  // Handle Nuxt $fetch errors
  addRouteMiddleware('global-error-handler', (to, from) => {
    // This middleware will run on every route change
    // We can use it to check for authentication errors
  });
  
  // Handle unhandled promise rejections
  if (process.client) {
    window.addEventListener('unhandledrejection', async (event) => {
      console.error('[Global Error Handler] Unhandled promise rejection:', event.reason);
      
      // Check if the error is an authentication error (by status code or message)
      if (isAuthError(event.reason)) {
        console.log('[Global Error Handler] Authentication error in unhandled rejection, triggering automatic logout');
        event.preventDefault(); // Prevent the default error handling
        await handleAutoLogout();
      }
    });
  }
});
