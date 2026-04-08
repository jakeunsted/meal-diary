import { useAuthStore } from '~/stores/auth';
import { useMealDiaryStore } from '~/stores/mealDiary';
import { useShoppingListStore } from '~/stores/shoppingList';
import { useUserStore } from '~/stores/user';
import { useTokenRefreshSSE } from '~/composables/useTokenRefreshSSE';

/**
 * Composable for managing Server-Sent Events (SSE) connection
 * Handles setup, event handlers, and cleanup for real-time updates
 */
export const useSSE = () => {
  const authStore = useAuthStore();
  const mealDiaryStore = useMealDiaryStore();
  const shoppingListStore = useShoppingListStore();
  const userStore = useUserStore();
  const { $sse } = useNuxtApp();
  const { handleTokenRefresh } = useTokenRefreshSSE();
  const router = useRouter();

  let sseConnection: EventSource | null = null;

  /**
   * Setup SSE connection with all event handlers
   */
  const setupSSEConnection = async (familyGroupId: number) => {
    // Initialize stores
    await mealDiaryStore.initialize();
    await shoppingListStore.fetchShoppingList();

    // Setup global SSE connection for meal diary and shopping list
    if (!sseConnection) {
      sseConnection = $sse.setup(familyGroupId, {
        // Token refresh events
        'token-refresh': handleTokenRefresh,

        // Shopping list events
        'add-new-category': () => {
          // Categories are no longer used in the single-list UI.
        },
        'save-category': () => {
          // Categories are no longer used in the single-list UI.
        },
        'delete-category': () => {
          // Categories are no longer used in the single-list UI.
        },
        'update-category-order': () => {
          // Categories are no longer used in the single-list UI.
        },
        // Shopping list item events
        'add-item': (data) => {
          // Ignore events from the current user
          if (data.item?.created_by === authStore.user?.id) return;
          
          if (!shoppingListStore.shoppingList || !data.item) {
            return;
          }

          const existingIndex = shoppingListStore.shoppingList.items.findIndex(
            item => item.id === data.item.id
          );

          if (existingIndex === -1) {
            shoppingListStore.shoppingList.items.push(data.item);
          } else {
            shoppingListStore.shoppingList.items[existingIndex] = data.item;
          }

          shoppingListStore.saveToLocalStorage();
        },
        'delete-item': (data) => {
          // Ignore events from the current user
          if (data.item?.created_by === authStore.user?.id) return;
          
          if (!shoppingListStore.shoppingList || !data.item?.id) {
            return;
          }

          shoppingListStore.shoppingList.items = shoppingListStore.shoppingList.items.filter(
            item => item.id !== data.item.id
          );
          shoppingListStore.saveToLocalStorage();
        },
        'check-item': (data) => {
          if (!shoppingListStore.shoppingList || !data.item?.id) {
            return;
          }

          const index = shoppingListStore.shoppingList.items.findIndex(
            item => item.id === data.item.id
          );

          if (index !== -1) {
            shoppingListStore.shoppingList.items[index] = {
              ...shoppingListStore.shoppingList.items[index],
              checked: true
            };
            shoppingListStore.saveToLocalStorage();
          }
        },
        'uncheck-item': (data) => {
          if (!shoppingListStore.shoppingList || !data.item?.id) {
            return;
          }

          const index = shoppingListStore.shoppingList.items.findIndex(
            item => item.id === data.item.id
          );

          if (index !== -1) {
            shoppingListStore.shoppingList.items[index] = {
              ...shoppingListStore.shoppingList.items[index],
              checked: false
            };
            shoppingListStore.saveToLocalStorage();
          }
        },
        'move-item': (data) => {
          if (!shoppingListStore.shoppingList || !data.item?.id) {
            return;
          }

          const index = shoppingListStore.shoppingList.items.findIndex(
            item => item.id === data.item.id
          );

          if (index !== -1) {
            shoppingListStore.shoppingList.items[index] = {
              ...shoppingListStore.shoppingList.items[index],
              parent_item_id: data.item.parent_item_id ?? null,
              position: data.item.position
            };
            shoppingListStore.saveToLocalStorage();
          }
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
  };

  /**
   * Close SSE connection
   */
  const closeSSEConnection = () => {
    if (sseConnection) {
      $sse.close();
      sseConnection = null;
    }
  };

  /**
   * Initialize SSE connection when user is authenticated
   */
  const initializeSSE = () => {
    watch(() => authStore.isAuthenticated, async (isAuthenticated) => {
      if (isAuthenticated) {
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
          await setupSSEConnection(userStore.user.family_group_id);
        }
      } else {
        closeSSEConnection();
      }
    }, { immediate: true });
  };

  /**
   * Cleanup SSE connection on unmount
   */
  const cleanupSSE = () => {
    onUnmounted(() => {
      closeSSEConnection();
    });
  };

  return {
    initializeSSE,
    cleanupSSE,
    closeSSEConnection
  };
};

