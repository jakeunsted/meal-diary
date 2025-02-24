<template>
  <div class="">
    <h1 class="text-2xl font-bold text-center m-4">
      Shopping List
    </h1>
    <CollapseListSection class="mx-4" categoryTitle="Fruits" :categoryItems="dummyFruits" />
  </div>
</template>

<script setup>
import CollapseListSection from '~/components/shopping-list/CollapseListSection.vue';

const dummyFruits = [
  { id: 1, name: 'Apple' },
  { id: 2, name: 'Banana' },
  { id: 3, name: 'Cherry' },
];

</script>