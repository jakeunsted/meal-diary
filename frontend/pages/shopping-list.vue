<template>
  <div class="">
    <h1 class="text-2xl font-bold text-center m-4">
      Shopping List
    </h1>
    <div>
      <div v-for="category in shoppingCategories" :key="category.id">
        <CollapseListSection class="mx-4" :categoryTitle="category.name" :categoryItems="category.items" />
      </div>
    </div>
  </div>
</template>

<script setup>
import CollapseListSection from '~/components/shopping-list/CollapseListSection.vue';

const dummyFruits = [
  { id: 1, name: 'Apple' },
  { id: 2, name: 'Banana' },
  { id: 3, name: 'Cherry' },
];

const dummyMeats = [
  { id: 1, name: 'Beef' },
  { id: 2, name: 'Chicken' },
  { id: 3, name: 'Fish' },
];

const dummyBaking = [
  { id: 1, name: 'Bread' },
  { id: 2, name: 'Cake' },
  { id: 3, name: 'Pastry' },
];

const dummyAlcohol = [
  { id: 1, name: 'Beer' },
  { id: 2, name: 'Wine' },
  { id: 3, name: 'Spirits' },
];

const dummyOther = [
  { id: 1, name: 'Sponges' },
];

const shoppingCategories = ref([
  { id: 1, name: 'Fruits & Vegetables', items: dummyFruits },
  { id: 2, name: 'Meat & Fish', items: dummyMeats },
  { id: 3, name: 'Baking', items: dummyBaking },
  { id: 4, name: 'Alcohol', items: dummyAlcohol },
  { id: 5, name: 'Other', items: dummyOther },
]);

</script>