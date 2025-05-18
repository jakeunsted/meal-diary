import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore();
  const publicRoutes = ['/login', '/register', '/forgot-password'];
  
  // Only run client-side checks to avoid SSR issues
  if (import.meta.client) {
    // Check if we have auth data in localStorage but not in the store
    if (!authStore.isAuthenticated && localStorage.getItem('authState')) {
      // Force re-initialization of auth store
      authStore.initializeAuth();
    }
    
    // Redirect authenticated users away from public routes
    if (publicRoutes.includes(to.path) && authStore.isAuthenticated) {
      if (authStore.user?.family_group_id) {
        console.log('User is authenticated and has a family group ID:', authStore.user.family_group_id);
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