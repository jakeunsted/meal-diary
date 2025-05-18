import { useShoppingListStore } from '~/stores/shoppingList';
import type { SSEShoppingListCategoryUpdate, ShoppingListCategory, ShoppingListState } from '~/types/ShoppingList';

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
      (category: ShoppingListCategory): boolean => category.name === categoryName
    );
    
    if (!existingCategory) {
      // Add category to store without API call
      shoppingListStore.$patch((state: ShoppingListState): void => {
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
    shoppingListStore.$patch((state: ShoppingListState): void => {
      if (state.shoppingList?.content) {
        const categoryIndex = state.shoppingList.content.categories.findIndex(
          (category: ShoppingListCategory): boolean => category.name === categoryName
        );
        
        if (categoryIndex !== -1) {
          state.shoppingList.content.categories[categoryIndex].items = categoryContents.items;
        }
      }
    });
  };

  const handleRemoteCategoryDeleted = (data: { categoryName: string }) => {
    console.log('handleRemoteCategoryDeleted', data);
    const { categoryName } = data;
    console.log('categoryName', categoryName);
    
    if (!shoppingListStore.getShoppingListContent) return;
    
    // Remove the category from the store
    shoppingListStore.$patch((state: ShoppingListState): void => {
      if (state.shoppingList?.content) {
        state.shoppingList.content.categories = state.shoppingList.content.categories.filter(
          (category: ShoppingListCategory): boolean => category.name !== categoryName
        );
      }
    });
  };
  
  // Return the handlers
  return {
    handleRemoteCategoryAdded,
    handleRemoteCategorySaved,
    handleRemoteCategoryDeleted
  };
}
