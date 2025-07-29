import { handleAutoLogout } from '~/composables/useAuth';

export default defineNuxtPlugin(() => {
  // Handle global fetch errors
  if (process.client) {
    // Override the global fetch to catch 401 errors
    const originalFetch = window.fetch;
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
      try {
        const response = await originalFetch(input, init);
        
        // If we get a 401 response, trigger automatic logout
        if (response.status === 401) {
          console.log('[Global Error Handler] 401 error detected, triggering automatic logout');
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
      
      // Check if the error is a 401 error
      if (event.reason?.statusCode === 401 || event.reason?.status === 401) {
        console.log('[Global Error Handler] 401 error in unhandled rejection, triggering automatic logout');
        event.preventDefault(); // Prevent the default error handling
        await handleAutoLogout();
      }
    });
  }
});
