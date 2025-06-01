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
          class=""
          :class="{ 'drag-over-top': isDragOverTop(category), 'drag-over-bottom': isDragOverBottom(category) }"
          @dragover.prevent="handleDragOver($event, category)"
          @dragleave.prevent="handleDragLeave(category)"
          @drop="handleDrop($event, category)"
        >
          <CollapseListSection
            class="m-4"
            :categoryTitle="category?.itemCategory?.name || ''"
            :categoryItems="category?.items || []"
            @addItem="saveCategory(category, $event)"
            @updateItem="saveCategory(category, $event)"
            @longPress="handleLongPress(category)"
            @dragStart="handleDragStart"
            @dragEnd="handleDragEnd"
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
      :itemCategories="shoppingListStore.itemCategories?.data || []"
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

const { $sse } = useNuxtApp();
const shoppingListStore = useShoppingListStore();
const userStore = useUserStore();
const { handleRemoteCategoryAdded, handleRemoteCategorySaved, handleRemoteCategoryDeleted } = useShoppingListSSE();

const loading = ref(false);
const selectedCategory = ref(null);
const categoryOptionsModal = ref(null);
const addCategoryModal = ref(null);
const draggedCategory = ref(null);
const dragOverCategory = ref(null);
const dragOverPosition = ref(null);
const hasData = computed(() => {
  return !!shoppingListStore.shoppingList?.categories?.length;
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
  await saveCategory(updatedCategory);
};

const handleTickAll = async () => {
  if (!selectedCategory.value) return;
  const updatedCategory = {
    ...selectedCategory.value,
    items: selectedCategory.value.items.map(item => ({ ...item, checked: true }))
  };
  await saveCategory(updatedCategory);
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

const saveCategory = async (category, event) => {
  if (event?.itemName) {
    // Handle item update
    const item = category.items.find(i => i.name === event.itemName);
    if (item) {
      // Only update name and checked status
      await shoppingListStore.updateItem(item.id, {
        name: event.itemName,
        checked: event.itemChecked,
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

const handleDragStart = (categoryName) => {
  draggedCategory.value = categoryName;
};

const handleDragEnd = () => {
  draggedCategory.value = null;
  dragOverCategory.value = null;
  dragOverPosition.value = null;
};

const isDragOverTop = (category) => {
  return dragOverCategory.value === category?.itemCategory?.name && dragOverPosition.value === 'top';
};

const isDragOverBottom = (category) => {
  return dragOverCategory.value === category?.itemCategory?.name && dragOverPosition.value === 'bottom';
};

const handleDragOver = (event, category) => {
  if (!draggedCategory.value || !category?.itemCategory?.name || draggedCategory.value === category.itemCategory.name) return;
  
  const rect = event.currentTarget.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const threshold = rect.height / 2;
  
  dragOverCategory.value = category.itemCategory.name;
  dragOverPosition.value = y < threshold ? 'top' : 'bottom';
};

const handleDragLeave = (category) => {
  if (!category?.itemCategory?.name) return;
  if (dragOverCategory.value === category.itemCategory.name) {
    dragOverCategory.value = null;
    dragOverPosition.value = null;
  }
};

const handleDrop = async (event, targetCategory) => {
  if (!draggedCategory.value || !targetCategory?.itemCategory?.name || draggedCategory.value === targetCategory.itemCategory.name) return;
  
  const categories = [...shoppingCategories.value];
  const draggedIndex = categories.findIndex(c => c.itemCategory?.name === draggedCategory.value);
  const targetIndex = categories.findIndex(c => c.itemCategory?.name === targetCategory.itemCategory.name);
  
  if (draggedIndex === -1 || targetIndex === -1) return;
  
  // Reorder the categories
  const [movedCategory] = categories.splice(draggedIndex, 1);
  const newIndex = dragOverPosition.value === 'top' ? targetIndex : targetIndex + 1;
  categories.splice(newIndex, 0, movedCategory);
  
  // Update the store with the new order
  await shoppingListStore.updateCategoryOrder(userStore.user?.family_group_id, categories);
  
  // Reset drag state
  dragOverCategory.value = null;
  dragOverPosition.value = null;
};

// Add function to handle input focus
const handleInputFocus = (event) => {
  // Add a small delay to ensure the keyboard has opened
  setTimeout(() => {
    event.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
};

const handleAddCategory = async (category) => {
  try {
    console.log('handleAddCategory', category);
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
    } catch (error) {
      handleError(error);
    }
  };

  // Start loading data
  loadData();
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

.drag-over-top {
  border-top: 2px solid #3b82f6;
  margin-top: -2px;
}

.drag-over-bottom {
  border-bottom: 2px solid #3b82f6;
  margin-bottom: -2px;
}

.list-item {
  transition: all 0.2s ease;
}
</style>
