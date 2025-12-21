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

// Add New Relic script for web browsers only
onMounted(async () => {
  if (process.client) {
    const { Capacitor } = await import('@capacitor/core');
    // Only load browser New Relic if we're not in a Capacitor environment
    if (!Capacitor.isNativePlatform()) {
      const { BrowserAgent, Interaction } = await import('@newrelic/browser-agent');
      
      const browserAgent = new BrowserAgent({
        accountID: "6817137",
        trustKey: "6817137",
        agentID: "538727353",
        licenseKey: "NRJS-5bdc2fe008beea400a1",
        applicationID: "538727353",
        beacon: "bam.eu01.nr-data.net",
        errorBeacon: "bam.eu01.nr-data.net",
        distributedTracing: { enabled: true },
        privacy: { cookies_enabled: true },
        ajax: { deny_list: ["bam.eu01.nr-data.net"] },
        sessionReplay: {
          enabled: true,
          block_selector: '',
          mask_text_selector: '*',
          sampling_rate: 10.0,
          error_sampling_rate: 100.0,
          mask_all_inputs: true,
          collect_fonts: true,
          inline_images: false,
          inline_stylesheet: true,
          fix_stylesheets: true,
          preload: false,
          mask_input_options: {}
        },
        pageViewTiming: {
          enabled: true
        },
        spa: {
          enabled: true,
          harvestTimeSeconds: 10
        }
      });

      // Wait for browser agent to initialize
      await browserAgent.ready;

      // Track page views
      const router = useRouter();
      router.afterEach((to) => {
        if (Interaction) {
          Interaction.startInteraction('PageView', () => {
            Interaction.setName(to.path);
            Interaction.endInteraction();
          });
        }
      });
    }
  }
});

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
