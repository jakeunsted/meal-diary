import { useShoppingListStore } from '~/stores/shoppingList';
import type { SSEShoppingListCategoryUpdate } from '~/types/ShoppingList';

export function useShoppingListSSE() {
  const shoppingListStore = useShoppingListStore();
  
  // Get shopping categories from the store
  const shoppingCategories = computed(() => 
    shoppingListStore.getShoppingListContent?.categories || []
  );
  
  const handleRemoteCategoryAdded = (data: SSEShoppingListCategoryUpdate) => {
    const { categoryName, categoryContents } = data;
    
    if (!shoppingListStore.getShoppingListContent) return;
    
    // Check if category already exists
    const existingCategory = shoppingCategories.value.find(
      category => category.name === categoryName
    );
    
    if (!existingCategory) {
      // Add category to store without API call
      shoppingListStore.$patch((state) => {
        if (state.shoppingList?.content) {
          state.shoppingList.content.categories.push(categoryContents);
        }
      });
    }
  };
  
  const handleRemoteCategorySaved = (data: SSEShoppingListCategoryUpdate) => {
    const { categoryName, categoryContents } = data;
    
    if (!shoppingListStore.getShoppingListContent) return;
    
    // Find and update category
    shoppingListStore.$patch((state) => {
      if (state.shoppingList?.content) {
        const categoryIndex = state.shoppingList.content.categories.findIndex(
          category => category.name === categoryName
        );
        
        if (categoryIndex !== -1) {
          state.shoppingList.content.categories[categoryIndex].items = categoryContents.items;
        }
      }
    });
  };
  
  // Return the handlers
  return {
    handleRemoteCategoryAdded,
    handleRemoteCategorySaved
  };
}
