export default defineNuxtPlugin(async () => {
  if (!import.meta.client) {
    return;
  }

  const authStore = useAuthStore();
  const userStore = useUserStore();
  const { configure, logIn, isNativePlatform } = useRevenueCat();
  const { api } = useApi();

  if (!isNativePlatform.value || !authStore.isAuthenticated) {
    return;
  }

  const familyGroupId = userStore.user?.family_group_id || authStore.user?.family_group_id;
  if (!familyGroupId) {
    return;
  }

  try {
    await configure();
    const response = await api('/api/billing/link-revenuecat', {
      method: 'POST',
      silent: true,
      body: { family_group_id: familyGroupId },
    });
    const appUserId = response?.app_user_id;
    if (appUserId) {
      await logIn(appUserId);
    }
  } catch (error) {
    console.warn('[RevenueCat] Failed to configure native billing', error);
  }
});
