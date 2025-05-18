import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware(async (to, from) => {
  const authStore = useAuthStore();
  const publicRoutes = ['/login', '/register', '/forgot-password'];

  // don't allow refresh on step-2 registration page
  if (to.path === '/registration/step-2' && from.path === '/registration/step-2') {
    return navigateTo('/logout');
  }
  
  // Only run client-side checks to avoid SSR issues
  if (import.meta.client) {
    await authStore.initializeAuth();
    
    // Redirect authenticated users away from public routes
    if (publicRoutes.includes(to.path) && authStore.isAuthenticated) {
      if (authStore.user?.family_group_id) {
        return navigateTo('/diary');
      } else {
        return navigateTo('/registration/step-2');
      }
    }
    
    // Redirect unauthenticated users to login for protected routes
    if (!publicRoutes.includes(to.path) && !authStore.isAuthenticated) {
      return navigateTo('/login');
    }
  }
}); 