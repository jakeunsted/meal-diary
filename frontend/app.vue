<template>
  <div class="min-h-screen safe-top safe-bottom">
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
// Add New Relic script
onMounted(() => {
  if (process.client) {
    console.log('New Relic script loaded');
    useHead({
      script: [
        {
          innerHTML: `
            window.NREUM||(NREUM={});NREUM.init={session_replay:{enabled:true,block_selector:'',mask_text_selector:'*',sampling_rate:10.0,error_sampling_rate:100.0,mask_all_inputs:true,collect_fonts:true,inline_images:false,inline_stylesheet:true,fix_stylesheets:true,preload:false,mask_input_options:{}},distributed_tracing:{enabled:true},privacy:{cookies_enabled:true},ajax:{deny_list:["bam.eu01.nr-data.net"]}};
            NREUM.loader_config={accountID:"6817137",trustKey:"6817137",agentID:"538727353",licenseKey:"NRJS-5bdc2fe008beea400a1",applicationID:"538727353"};
            NREUM.info={beacon:"bam.eu01.nr-data.net",errorBeacon:"bam.eu01.nr-data.net",licenseKey:"NRJS-5bdc2fe008beea400a1",applicationID:"538727353",sa:1};
          `,
          type: 'text/javascript'
        },
        {
          src: 'https://js-agent.newrelic.com/nr-spa-1216.min.js',
          type: 'text/javascript',
          async: true
        }
      ]
    });
  }
});

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

<style>
.safe-top {
  padding-top: env(safe-area-inset-top);
}

.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
