<template>
  <div class="max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold text-center m-4">
      {{ $t('Shopping List') }}
    </h1>

    <ShoppingListSkeleton v-if="!hasData" />
    <div v-else>
      <transition-group 
        name="list" 
        tag="div"
        class="relative"
      >
        <div 
          v-for="category in shoppingCategories" 
          :key="category.id"
        >
          <CollapseListSection
            class="m-4"
            :categoryTitle="category?.itemCategory?.name || ''"
            :categoryItems="category?.items || []"
            @addItem="saveItem(category, $event)"
            @updateItem="saveItem(category, $event)"
            @removeItem="deleteItem(category, $event)"
            @longPress="handleLongPress(category)"
            @inputFocus="handleInputFocus"
          />
        </div>
      </transition-group>
    </div>

    <div class="flex justify-center" v-if="hasData">
      <button class="btn btn-primary rounded-2xl" @click="addCategoryModal?.showModal()">{{ $t('Add Category') }}</button>
    </div>
    <AddCategoryModal
      ref="addCategoryModal"
      :itemCategories="shoppingListStore.itemCategories || []"
      :loading="shoppingListStore.isLoading"
      @addCategory="handleAddCategory"
    />
    <CategoryOptionsModal
      ref="categoryOptionsModal"
      v-if="selectedCategory"
      :categoryName="selectedCategory.itemCategory.name"
      @untickAll="handleUntickAll"
      @tickAll="handleTickAll"
      @deleteGroup="handleDeleteGroup"
    />
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth'
});

import CollapseListSection from '~/components/shopping-list/CollapseListSection.vue';
import AddCategoryModal from '~/components/shopping-list/AddCategoryModal.vue';
import CategoryOptionsModal from '~/components/shopping-list/CategoryOptionsModal.vue';
import ShoppingListSkeleton from '~/components/shopping-list/ShoppingListSkeleton.vue';
import { useShoppingListStore } from '~/stores/shoppingList';
import { useUserStore } from '~/stores/user';
import { useShoppingListSSE } from '~/composables/useShoppingListSSE';

const { $sse } = useNuxtApp();
const shoppingListStore = useShoppingListStore();
const userStore = useUserStore();
const { setupShoppingListSSE, closeShoppingListSSE } = useShoppingListSSE();

const loading = ref(true);
const selectedCategory = ref(null);
const categoryOptionsModal = ref(null);
const addCategoryModal = ref(null);
const hasData = computed(() => {
  return !loading.value && shoppingListStore.shoppingList?.categories !== undefined;
});

const handleError = (error) => {
  console.error('Error in shopping list page:', error);
};

// Use computed property to ensure reactivity to store changes
const shoppingCategories = computed(() => 
  shoppingListStore.shoppingList?.categories || []
);

const handleLongPress = (category) => {
  selectedCategory.value = category;
  categoryOptionsModal.value?.showModal();
};

const handleUntickAll = async () => {
  if (!selectedCategory.value) return;
  const updatedCategory = {
    ...selectedCategory.value,
    items: selectedCategory.value.items.map(item => ({ ...item, checked: false }))
  };
  await saveItem(updatedCategory);
};

const handleTickAll = async () => {
  if (!selectedCategory.value) return;
  const updatedCategory = {
    ...selectedCategory.value,
    items: selectedCategory.value.items.map(item => ({ ...item, checked: true }))
  };
  await saveItem(updatedCategory);
};

const handleDeleteGroup = async () => {
  if (!selectedCategory.value) return;
  try {
    await shoppingListStore.deleteCategory(selectedCategory.value.id);
    categoryOptionsModal.value?.close();
  } catch (error) {
    console.error('Error deleting category:', error);
  }
};

const saveItem = async (category, event) => {
  if (event?.itemName) {
    if (event.id) {
      // Only update name and checked status
      await shoppingListStore.updateItem(event.id, {
        name: event.itemName,
        checked: event.itemChecked || false,
        shopping_list_categories: category.id
      });
    } else {
      await shoppingListStore.addItem({
        name: event.itemName,
        shopping_list_categories: category.id
      });
    }
  } else {
    // Handle category update
    await shoppingListStore.updateCategoryOrder(userStore.user?.family_group_id, [category]);
  }
};

const deleteItem = async (category, event) => {
  if (event?.itemName) {
    const item = category.items.find(i => i.name === event.itemName);
    if (item) {
      await shoppingListStore.deleteItem(item.id);
    }
  }
}

// Add function to handle input focus
const handleInputFocus = async (event) => {
  // Use the improved mobile input scroll functionality
  const { scrollToInput } = useMobileInputScroll();
  scrollToInput(event.target);
  
  // For Capacitor Android, also ensure the input is visible
  if (import.meta.client) {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent)) {
        // Additional scroll to ensure input is visible
        setTimeout(() => {
          event.target.scrollIntoView({ 
            behavior: 'auto', 
            block: 'center',
            inline: 'nearest'
          });
        }, 600);
      }
    } catch (error) {
      console.warn('Could not import Capacitor:', error);
    }
  }
};

const handleAddCategory = async (category) => {
  try {
    await shoppingListStore.addCategory(category);
    addCategoryModal.value?.closeModal();
  } catch (error) {
    console.error('Error adding category:', error);
  }
};

onMounted(async () => {
  await nextTick();
  
  // Start loading data after skeleton is visible
  const loadData = async () => {
    try {
      // Start all requests in parallel
      await Promise.all([
        shoppingListStore.fetchShoppingList().catch(handleError),
        userStore.fetchUser().catch(handleError),
        shoppingListStore.fetchItemCategories().catch(handleError)
      ]);

      // Set up SSE connection after data is loaded
      if (userStore.user?.family_group_id) {
        setupShoppingListSSE(userStore.user.family_group_id);
      }
    } catch (error) {
      handleError(error);
    } finally {
      loading.value = false;
    }
  };

  // Start loading data
  loadData();
  
  // Add viewport resize listener for keyboard handling
  if (import.meta.client) {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent)) {
        let initialViewportHeight = window.innerHeight;
        
        const handleViewportResize = () => {
          const currentHeight = window.innerHeight;
          const heightDifference = initialViewportHeight - currentHeight;
          
          // If viewport height decreased significantly, keyboard likely opened
          if (heightDifference > 150) {
            // Find focused input and scroll to it
            const focusedElement = document.activeElement;
            if (focusedElement && focusedElement.tagName === 'INPUT') {
              setTimeout(() => {
                focusedElement.scrollIntoView({ 
                  behavior: 'auto', 
                  block: 'center',
                  inline: 'nearest'
                });
              }, 100);
            }
          }
          
          initialViewportHeight = currentHeight;
        };
        
        window.addEventListener('resize', handleViewportResize);
        
        // Cleanup on unmount
        onUnmounted(() => {
          window.removeEventListener('resize', handleViewportResize);
        });
      }
    } catch (error) {
      console.warn('Could not set up viewport resize listener:', error);
    }
  }
});

onUnmounted(() => {
  closeShoppingListSSE();
});
</script>

<style>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.list-move {
  transition: transform 0.3s ease;
}

.list-item {
  transition: all 0.2s ease;
}

/* Ensure the page is scrollable and handles keyboard properly */
.max-w-4xl {
  min-height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Ensure inputs are properly positioned when keyboard opens */
.input:focus {
  position: relative;
  z-index: 10;
}
</style>
