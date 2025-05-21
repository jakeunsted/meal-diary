<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup>
const authStore = useAuthStore();
const mealDiaryStore = useMealDiaryStore();
const shoppingListStore = useShoppingListStore();
const userStore = useUserStore();
const { $sse } = useNuxtApp();

let sseConnection = null;

// Initialize auth store
onMounted(async () => {
  await authStore.initializeAuth();
  
  // Try to load user data from storage first
  if (authStore.isAuthenticated) {
    await userStore.loadFromStorage();
  }
});

// Initialize stores and SSE when user is authenticated
watch(() => userStore.isAuthenticated, async (isAuthenticated) => {
  if (isAuthenticated && userStore.user?.family_group_id) {
    // Initialize stores
    await mealDiaryStore.initialize();
    await shoppingListStore.fetchShoppingList(userStore.user.family_group_id);

    // Setup global SSE connection for meal diary and shopping list
    if (!sseConnection) {
      sseConnection = $sse.setup(userStore.user.family_group_id, {
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

        // Meal diary events
        'update-daily-meal': (data) => mealDiaryStore.handleDailyMealUpdate(data.dailyMeal),
        'initial': (data) => {
          if (data.mealDiary) {
            mealDiaryStore.updateMealsFromEvents(data.mealDiary);
          }
        }
      });
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
