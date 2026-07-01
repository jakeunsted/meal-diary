export default defineNuxtPlugin(async () => {
  if (!import.meta.client) {
    return;
  }

  const authStore = useAuthStore();
  const subscriptionStore = useSubscriptionStore();
  const { refreshEntitlements } = useEntitlements();

  await subscriptionStore.hydrateFromStorage();

  if (authStore.isAuthenticated && authStore.user?.family_group_id) {
    try {
      await refreshEntitlements();
    } catch {
      // Cached entitlements or a later navigation can refresh.
    }
  }
});
