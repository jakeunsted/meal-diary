import { useAuthStore } from '~/stores/auth';
import { hasFamilyGroup } from '~/composables/useAuth';

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
    
    // Log auth state for debugging
    console.log('[Auth Middleware] Auth state:', {
      isAuthenticated: authStore.isAuthenticated,
      hasUser: !!authStore.user,
      userId: authStore.user?.id,
      userEmail: authStore.user?.email,
      family_group_id: authStore.user?.family_group_id,
      hasFamilyGroup: hasFamilyGroup(authStore.user),
      currentPath: to.path,
      isPublicRoute: publicRoutes.includes(to.path)
    });
    
    // Redirect authenticated users away from public routes
    if (publicRoutes.includes(to.path) && authStore.isAuthenticated) {
      if (hasFamilyGroup(authStore.user)) {
        console.log('[Auth Middleware] User has family group, redirecting to diary');
        return navigateTo('/diary');
      } else {
        console.log('[Auth Middleware] User has no family group, redirecting to step-2');
        return navigateTo('/registration/step-2');
      }
    }
    
    // Redirect unauthenticated users to login for protected routes
    if (!publicRoutes.includes(to.path) && !authStore.isAuthenticated) {
      console.log('[Auth Middleware] User not authenticated, redirecting to login');
      return navigateTo('/login');
    }
  }
}); 