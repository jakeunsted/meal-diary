import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore();
  const publicRoutes = ['/login', '/register', '/forgot-password'];
  
  // Allow access to public routes
  if (publicRoutes.includes(to.path)) {
    return;
  }
  
  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    // Redirect to login page
    return navigateTo('/login');
  }
}); 