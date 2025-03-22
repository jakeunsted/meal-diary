<template>
  <div class="">
    <h1 class="text-2xl font-bold text-center m-4">
      Shopping List
    </h1>
    <div>
      <div v-for="category in shoppingCategories" :key="category.id">
        <CollapseListSection class="m-4" :categoryTitle="category.name" :categoryItems="category.items" />
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

const saveNewCategory = async () => {
  if (newCategoryName.value === '') {
    return;
  }
  const newCategory = await shoppingListStore.addCategory(newCategoryName.value);
  newCategoryName.value = '';
  add_category_modal.close();
}

onMounted(async () => {
  await userStore.fetchUser(1);
  console.log('userStore.user?.family_group_id', userStore.user?.family_group_id);
  const shoppingListContent = await shoppingListStore.fetchShoppingList(userStore.user?.family_group_id);
  shoppingCategories.value = shoppingListContent.categories;
});

// const dummyFruits = [
//   { id: 1, name: 'Apple' },
//   { id: 2, name: 'Banana' },
//   { id: 3, name: 'Cherry' },
// ];

// const dummyMeats = [
//   { id: 1, name: 'Beef' },
//   { id: 2, name: 'Chicken' },
//   { id: 3, name: 'Fish' },
// ];

// const dummyBaking = [
//   { id: 1, name: 'Bread' },
//   { id: 2, name: 'Cake' },
//   { id: 3, name: 'Pastry' },
// ];

// const dummyAlcohol = [
//   { id: 1, name: 'Beer' },
//   { id: 2, name: 'Wine' },
//   { id: 3, name: 'Spirits' },
// ];

// const dummyOther = [
//   { id: 1, name: 'Sponges' },
// ];

// const shoppingCategories = ref([
//   { id: 1, name: 'Fruits & Vegetables', items: dummyFruits },
//   { id: 2, name: 'Meat & Fish', items: dummyMeats },
//   { id: 3, name: 'Baking', items: dummyBaking },
//   { id: 4, name: 'Alcohol', items: dummyAlcohol },
//   { id: 5, name: 'Other', items: dummyOther },
// ]);

</script>