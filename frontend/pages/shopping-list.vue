<template>
  <div class="">
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
    <dialog id="add_category_modal" class="modal">
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
      <div class="modal-box">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        <h3 class="text-lg font-bold mb-2">Add Category</h3>
        <input type="text" class="input input-bordered w-full mb-4" required v-model="newCategoryName" placeholder="Category Name" />
        <div class="flex flex-col items-center">
          <button class="btn btn-outline btn-primary btn-sm" @click="saveNewCategory">Save</button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import CollapseListSection from '~/components/shopping-list/CollapseListSection.vue';
import { useShoppingListStore } from '~/stores/shoppingList';
import { useUserStore } from '~/stores/user';

const shoppingListStore = useShoppingListStore();
const userStore = useUserStore();

const newCategoryName = ref('');
const shoppingCategories = ref([]);
const loading = ref(true);

const saveNewCategory = async () => {
  if (newCategoryName.value === '') {
    return;
  }
  const newCategory = await shoppingListStore.addCategory(userStore.user?.family_group_id, newCategoryName.value);
  newCategoryName.value = '';
  add_category_modal.close();
  shoppingCategories.value.push(newCategory);
}

const saveCategory = async (category, event) => {
  shoppingListStore.saveCategory(userStore.user?.family_group_id, category.name, category);
}

onMounted(async () => {
  // Temp hardcoded user
  await userStore.fetchUser(1);
  if (shoppingListStore.getShoppingListContent) {
    shoppingCategories.value = shoppingListStore.getShoppingListContent?.categories;
  } else {
    await shoppingListStore.fetchShoppingList(userStore.user?.family_group_id);
    shoppingCategories.value = shoppingListStore.getShoppingListContent?.categories;
  }
  loading.value = false;
});
</script>