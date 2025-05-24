<template>
  <div class="max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold text-center m-4">
      {{ $t('Shopping List') }}
    </h1>

    <ShoppingListSkeleton v-if="loading" />
    <div v-else>
      <transition-group 
        name="list" 
        tag="div"
        class="relative"
      >
        <div 
          v-for="category in shoppingCategories" 
          :key="category.name"
          class=""
          :class="{ 'drag-over-top': isDragOverTop(category), 'drag-over-bottom': isDragOverBottom(category) }"
          @dragover.prevent="handleDragOver($event, category)"
          @dragleave.prevent="handleDragLeave(category)"
          @drop="handleDrop($event, category)"
        >
          <CollapseListSection
            class="m-4"
            :categoryTitle="category.name"
            :categoryItems="category.items"
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

    <div class="flex justify-center" v-if="!loading">
      <button class="btn btn-primary rounded-2xl" onclick="add_category_modal.showModal()">{{ $t('Add Category') }}</button>
    </div>
    <AddCategoryModal
      :newCategoryName="newCategoryName"
      :saveNewCategory="saveNewCategory"
      @update:newCategoryName="newCategoryName = $event"
    />
    <CategoryOptionsModal
      ref="categoryOptionsModal"
      v-if="selectedCategory"
      :categoryName="selectedCategory.name"
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

const newCategoryName = ref('');
const loading = ref(true);
const selectedCategory = ref(null);
const categoryOptionsModal = ref(null);
const draggedCategory = ref(null);
const dragOverCategory = ref(null);
const dragOverPosition = ref(null);

// Use computed property to ensure reactivity to store changes
const shoppingCategories = computed(() => 
  shoppingListStore.getShoppingListContent?.categories || []
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
    await $fetch(`/api/shopping-list/${userStore.user?.family_group_id}/delete-category`, {
      method: 'DELETE',
      params: {
        category_name: selectedCategory.value.name
      }
    });
    await shoppingListStore.fetchShoppingList(userStore.user?.family_group_id);
  } catch (error) {
    console.error('Error deleting category:', error);
  }
};

const saveNewCategory = async () => {
  if (newCategoryName.value === '') {
    return;
  }
  await shoppingListStore.addCategory(userStore.user?.family_group_id, newCategoryName.value);
  newCategoryName.value = '';
  add_category_modal.close();
}

const saveCategory = async (category, event) => {
  await shoppingListStore.saveCategory(userStore.user?.family_group_id, category.name, category);
}

const handleDragStart = (categoryName) => {
  draggedCategory.value = categoryName;
};

const handleDragEnd = () => {
  draggedCategory.value = null;
  dragOverCategory.value = null;
  dragOverPosition.value = null;
  emit('dragEnd');
};

const isDragOverTop = (category) => {
  return dragOverCategory.value === category.name && dragOverPosition.value === 'top';
};

const isDragOverBottom = (category) => {
  return dragOverCategory.value === category.name && dragOverPosition.value === 'bottom';
};

const handleDragOver = (event, category) => {
  if (!draggedCategory.value || draggedCategory.value === category.name) return;
  
  const rect = event.currentTarget.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const threshold = rect.height / 2;
  
  dragOverCategory.value = category.name;
  dragOverPosition.value = y < threshold ? 'top' : 'bottom';
};

const handleDragLeave = (category) => {
  if (dragOverCategory.value === category.name) {
    dragOverCategory.value = null;
    dragOverPosition.value = null;
  }
};

const handleDrop = async (event, targetCategory) => {
  if (!draggedCategory.value || draggedCategory.value === targetCategory.name) return;
  
  const categories = [...shoppingCategories.value];
  const draggedIndex = categories.findIndex(c => c.name === draggedCategory.value);
  const targetIndex = categories.findIndex(c => c.name === targetCategory.name);
  
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

onMounted(async () => {
  // Temp hardcoded user
  await userStore.fetchUser();

  if (!shoppingListStore.getShoppingListContent) {
    await shoppingListStore.fetchShoppingList(userStore.user?.family_group_id);
  }

  loading.value = false;
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
