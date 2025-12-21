<template>
  <div class="min-h-screen safe-top safe-bottom">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Toast />
  </div>
</template>

<script setup>
const authStore = useAuthStore();
const mealDiaryStore = useMealDiaryStore();
const shoppingListStore = useShoppingListStore();
const userStore = useUserStore();
const { $sse } = useNuxtApp();
const { handleTokenRefresh } = useTokenRefreshSSE();

let sseConnection = null;

// Initialize auth store
onMounted(async () => {
  await authStore.initializeAuth();
});

// Initialize stores and SSE when user is authenticated
watch(() => authStore.isAuthenticated, async (isAuthenticated) => {
  if (isAuthenticated) {
    const router = useRouter();
    const currentRoute = router.currentRoute.value;
    
    // Don't initialize stores on registration pages
    if (currentRoute.path?.startsWith('/registration')) {
      return;
    }
    
    // Check auth store first - if user doesn't have family_group_id, don't initialize
    if (!authStore.user?.family_group_id) {
      return;
    }
    
    // Ensure user data is loaded
    if (!userStore.user) {
      await userStore.loadFromStorage();
      if (!userStore.user) {
        await userStore.fetchUser();
      }
    }
    
    // Double-check user store has family_group_id (should match auth store)
    if (!userStore.user?.family_group_id) {
      return;
    }
    
    // Setup SSE connection if user has a family group
    if (userStore.user?.family_group_id) {
      // Initialize stores
      await mealDiaryStore.initialize();
      await shoppingListStore.fetchShoppingList();

      // Setup global SSE connection for meal diary and shopping list
      if (!sseConnection) {
        sseConnection = $sse.setup(userStore.user.family_group_id, {
          // Token refresh events
          'token-refresh': handleTokenRefresh,

          // Shopping list events
          'add-new-category': (data) => shoppingListStore.handleCategoryAdded(userStore.user.family_group_id, data.categoryName, data.categoryContents),
          'save-category': (data) => shoppingListStore.handleCategorySaved(userStore.user.family_group_id, data.categoryName, data.categoryContents),
          'delete-category': (data) => {
            if (shoppingListStore.shoppingList?.content) {
              shoppingListStore.shoppingList.content.categories = shoppingListStore.shoppingList.content.categories.filter(
                category => category.name !== data.categoryName
              );
              shoppingListStore.saveToLocalStorage();
            }
          },
          'update-category-order': (data) => {
            // if (shoppingListStore.shoppingList?.content) {
            //   shoppingListStore.shoppingList.content.categories = data.categoryContents;
            //   shoppingListStore.saveToLocalStorage();
            // }
          },

          // Meal diary events
          'update-daily-meal': (data) => mealDiaryStore.handleDailyMealUpdate(data.dailyMeal),
          'initial': (data) => {
            if (data.mealDiary) {
              mealDiaryStore.updateMealsFromEvents(data.mealDiary);
            }
          },
          'ping': (data) => {
            // Keep connection alive
          }
        });
      }
    }
  } else {
    if (sseConnection) {
      $sse.close();
      sseConnection = null;
    }
  }
}, { immediate: true });

// Cleanup SSE connection when app is unmounted
onUnmounted(() => {
  if (sseConnection) {
    $sse.close();
    sseConnection = null;
  }
});
</script>

<style>
.safe-top {
  padding-top: env(safe-area-inset-top);
}

.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
