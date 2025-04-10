<template>
  <div>
    <h1 class="text-2xl font-bold text-center m-4">
      Shopping List
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
        />
      </div>
    </div>

    <div class="flex justify-center">
      <button class="btn btn-primary rounded-2xl" onclick="add_category_modal.showModal()">Add Category</button>
    </div>
    <AddCategoryModal
      :newCategoryName="newCategoryName"
      :saveNewCategory="saveNewCategory"
      @update:newCategoryName="newCategoryName = $event"
    />
  </div>
</template>

<script setup>
import CollapseListSection from '~/components/shopping-list/CollapseListSection.vue';
import AddCategoryModal from '~/components/shopping-list/AddCategoryModal.vue';
import { useShoppingListStore } from '~/stores/shoppingList';
import { useUserStore } from '~/stores/user';

const shoppingListStore = useShoppingListStore();
const userStore = useUserStore();

const newCategoryName = ref('');
const loading = ref(true);

// Use computed property to ensure reactivity to store changes
const shoppingCategories = computed(() => 
  shoppingListStore.getShoppingListContent?.categories || []
);

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

// Set up event source for real-time updates
let eventSource = null;

const setupSSE = (familyGroupId) => {
  if (import.meta.client) {
    eventSource = new EventSource(`/api/server-sent-events/${familyGroupId}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'add-new-category') {
        handleRemoteCategoryAdded(data.data);
      } else if (data.type === 'save-category') {
        handleRemoteCategorySaved(data.data);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      eventSource.close();
      // Try to reconnect after a delay
      setTimeout(() => setupSSE(familyGroupId), 5000);
    };
  }
};

const handleRemoteCategoryAdded = (data) => {
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

const handleRemoteCategorySaved = (data) => {
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

onMounted(async () => {
  // Temp hardcoded user
  await userStore.fetchUser(1);

  if (!shoppingListStore.getShoppingListContent) {
    await shoppingListStore.fetchShoppingList(userStore.user?.family_group_id);
  }

  loading.value = false;
  
  // Setup SSE for real-time updates to shopping list
  if (userStore.user?.family_group_id) {
    setupSSE(userStore.user.family_group_id);
  }
});

onUnmounted(() => {
  // Clean up SSE connection
  if (eventSource) {
    eventSource.close();
  }
});
</script>
