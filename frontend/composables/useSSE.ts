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
        'add-new-category': (data) => {
          // Handle category added event
          if (shoppingListStore.shoppingList && data.category) {
            const categoryExists = shoppingListStore.shoppingList.categories.some(
              c => c.id === data.category.id
            );
            if (!categoryExists) {
              shoppingListStore.shoppingList.categories.push(data.category);
              shoppingListStore.saveToLocalStorage();
            }
          }
        },
        'save-category': (data) => {
          // Handle category saved event
          if (shoppingListStore.shoppingList && data.category) {
            const index = shoppingListStore.shoppingList.categories.findIndex(
              c => c.id === data.category.id
            );
            if (index !== -1) {
              shoppingListStore.shoppingList.categories[index] = data.category;
              shoppingListStore.saveToLocalStorage();
            }
          }
        },
        'delete-category': (data) => {
          if (shoppingListStore.shoppingList && data.category?.id) {
            shoppingListStore.shoppingList.categories = shoppingListStore.shoppingList.categories.filter(
              (category: any) => category.id !== data.category.id
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
        // Shopping list item events
        'add-item': (data) => {
          // Ignore events from the current user
          if (data.item?.created_by === authStore.user?.id) return;
          
          const category = shoppingListStore.shoppingList?.categories.find(c => c.id === data.category?.id);
          const itemExists = category?.items.some(item => item.name.toLowerCase() === data.item?.name?.toLowerCase());
          
          if (!itemExists && category && data.item) {
            category.items.push(data.item);
            shoppingListStore.saveToLocalStorage();
          }
        },
        'delete-item': (data) => {
          // Ignore events from the current user
          if (data.item?.created_by === authStore.user?.id) return;
          
          const category = shoppingListStore.shoppingList?.categories.find(c => c.id === data.category?.id);
          if (category && data.item?.id) {
            const index = category.items.findIndex(item => item.id === data.item.id);
            if (index !== -1) {
              category.items.splice(index, 1);
              shoppingListStore.saveToLocalStorage();
            }
          }
        },
        'check-item': (data) => {
          // Find category by item's shopping_list_categories field or category id
          const categoryId = data.item?.shopping_list_categories || data.category?.id;
          const category = shoppingListStore.shoppingList?.categories.find(c => c.id === categoryId);
          if (category && data.item?.id) {
            const index = category.items.findIndex(item => item.id === data.item.id);
            if (index !== -1) {
              category.items[index] = { ...category.items[index], checked: true };
              shoppingListStore.saveToLocalStorage();
            }
          }
        },
        'uncheck-item': (data) => {
          // Find category by item's shopping_list_categories field or category id (same as check-item)
          const categoryId = data.item?.shopping_list_categories || data.category?.id;
          const category = shoppingListStore.shoppingList?.categories.find(c => c.id === categoryId);
          if (category && data.item?.id) {
            const index = category.items.findIndex(item => item.id === data.item.id);
            if (index !== -1) {
              category.items[index] = { ...category.items[index], checked: false };
              shoppingListStore.saveToLocalStorage();
            }
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

