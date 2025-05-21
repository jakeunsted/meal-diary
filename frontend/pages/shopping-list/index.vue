<template>
  <div>
    <h1 class="text-2xl font-bold text-center m-4">
      {{ $t('Shopping List') }}
    </h1>

    <div v-if="loading">
      <div class="flex justify-center mb-4">
        <span class="loading loading-spinner loading-xl"></span>
      </div>
    </div>
    <div v-else>
      <div v-for="category in shoppingCategories" :key="category.name">
        <CollapseListSection
          class="m-4"
          :categoryTitle="category.name"
          :categoryItems="category.items"
          @addItem="saveCategory(category, $event)"
          @updateItem="saveCategory(category, $event)"
          @longPress="handleLongPress(category)"
        />
      </div>
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

onMounted(async () => {
  // Temp hardcoded user
  await userStore.fetchUser();

  if (!shoppingListStore.getShoppingListContent) {
    await shoppingListStore.fetchShoppingList(userStore.user?.family_group_id);
  }

  loading.value = false;
});
</script>
