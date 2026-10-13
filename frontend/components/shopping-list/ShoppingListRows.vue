<template>
  <ShoppingListSortableList :items="items" @reorder="(ids) => emit('reorder', ids)">
    <template #default="{ item }">
      <ShoppingListItem
        v-if="item"
        :item="item"
        :hide-checkbox="hideCheckbox"
        @update="emit('update', $event)"
        @remove="emit('remove', $event)"
        @insertBelow="emit('insertBelow', $event)"
        @moveCategory="emit('moveCategory', $event)"
      />
    </template>
  </ShoppingListSortableList>
</template>

<script setup lang="ts">
import ShoppingListItem from '~/components/shopping-list/ShoppingListItem.vue';
import ShoppingListSortableList from '~/components/shopping-list/ShoppingListSortableList.vue';
import type { ShoppingListItem as ShoppingListItemType } from '~/types/ShoppingList';

defineProps<{
  items: ShoppingListItemType[];
  hideCheckbox: boolean;
}>();

const emit = defineEmits<{
  reorder: [ids: Array<number | string>];
  update: [event: { id: number | string; name: string; checked?: boolean }];
  remove: [id: number | string];
  insertBelow: [id: number | string];
  moveCategory: [event: { id: number | string; category: string }];
}>();
</script>
