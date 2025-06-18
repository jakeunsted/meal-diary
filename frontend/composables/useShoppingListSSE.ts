import { useShoppingListStore } from '~/stores/shoppingList';
import type { ShoppingListCategoryWithItems, ShoppingListItem, ItemCategory } from '~/types/ShoppingList';
import { useAuthStore } from '~/stores/auth';

interface SSEItemData {
  item: ShoppingListItem;
  category: ShoppingListCategoryWithItems;
}

interface SSECategoryData {
  category: ShoppingListCategoryWithItems;
}

export const useShoppingListSSE = () => {
  const shoppingListStore = useShoppingListStore();
  const authStore = useAuthStore();
  const { $sse } = useNuxtApp();

  const setupShoppingListSSE = (familyGroupId: number) => {
    const handlers = {
      'add-item': (data: SSEItemData) => {
        // Ignore events from the current user
        if (data.item.created_by === authStore.user?.id) return;

        // Check if item with same name already exists in the category
        const category = shoppingListStore.shoppingList?.categories.find(c => c.id === data.category.id);
        const itemExists = category?.items.some(item => item.name.toLowerCase() === data.item.name.toLowerCase());
        
        if (!itemExists && category) {
          // Directly add the item to the category without making an API call
          category.items.push(data.item);
          shoppingListStore.saveToLocalStorage();
        }
      },
      'delete-item': (data: SSEItemData) => {
        // Ignore events from the current user
        if (data.item.created_by === authStore.user?.id) return;

        // Directly remove the item from the category without making an API call
        const category = shoppingListStore.shoppingList?.categories.find(c => c.id === data.category.id);
        if (category) {
          const index = category.items.findIndex(item => item.id === data.item.id);
          if (index !== -1) {
            category.items.splice(index, 1);
            shoppingListStore.saveToLocalStorage();
          }
        }
      },
      'check-item': (data: SSEItemData) => {
        // Ignore events from the current user
        if (data.item.created_by === authStore.user?.id) return;

        // Directly update the item in the category without making an API call
        const category = shoppingListStore.shoppingList?.categories.find(c => c.id === data.category.id);
        if (category) {
          const index = category.items.findIndex(item => item.id === data.item.id);
          if (index !== -1) {
            category.items[index] = { ...category.items[index], checked: true };
            shoppingListStore.saveToLocalStorage();
          }
        }
      },
      'uncheck-item': (data: SSEItemData) => {
        // Ignore events from the current user
        if (data.item.created_by === authStore.user?.id) return;

        // Directly update the item in the category without making an API call
        const category = shoppingListStore.shoppingList?.categories.find(c => c.id === data.category.id);
        if (category) {
          const index = category.items.findIndex(item => item.id === data.item.id);
          if (index !== -1) {
            category.items[index] = { ...category.items[index], checked: false };
            shoppingListStore.saveToLocalStorage();
          }
        }
      },
      'add-category': (data: SSECategoryData) => {
        // Ignore events from the current user
        if (data.category.created_by === authStore.user?.id) return;

        // Directly add the category to the shopping list without making an API call
        if (shoppingListStore.shoppingList) {
          const newCategory: ShoppingListCategoryWithItems = {
            ...data.category,
            items: []
          };

          shoppingListStore.shoppingList.categories.push(newCategory);
          shoppingListStore.saveToLocalStorage();
        }
      },
      'delete-category': (data: SSECategoryData) => {
        // Ignore events from the current user
        if (data.category.created_by === authStore.user?.id) return;

        // Directly remove the category from the shopping list without making an API call
        if (shoppingListStore.shoppingList) {
          const index = shoppingListStore.shoppingList.categories.findIndex(c => c.id === data.category.id);
          if (index !== -1) {
            shoppingListStore.shoppingList.categories.splice(index, 1);
            shoppingListStore.saveToLocalStorage();
          }
        }
      }
    };

    return $sse.setup(familyGroupId, handlers);
  };

  const closeShoppingListSSE = () => {
    $sse.close();
  };

  return {
    setupShoppingListSSE,
    closeShoppingListSSE
  };
};
