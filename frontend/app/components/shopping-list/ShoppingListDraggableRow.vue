<template>
  <div
    ref="rowRef"
    class="my-1 transition-opacity duration-150"
    :class="{ 'opacity-50': isDragging }"
    :style="{ marginLeft: `${depth * 1.5}rem` }"
  >
    <div class="flex items-center gap-2">
      <ShoppingListItem
        class="flex-1"
        :item="item"
        @update="handleItemUpdate"
        @remove="handleRemoveItem"
        @indent="handleIndent"
        @outdent="handleOutdent"
        @insertBelow="handleInsertBelow"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import ShoppingListItem from '~/components/shopping-list/ShoppingListItem.vue';
import { makeDraggable } from '@vue-dnd-kit/core';
import type { ShoppingListItem as ShoppingListItemType } from '~/types/ShoppingList';

const props = defineProps<{
  item: ShoppingListItemType;
  index: number;
  orderedItems: ShoppingListItemType[];
  depth: number;
}>();

const emit = defineEmits<{
  update: [event: { id: number | string; name: string; checked?: boolean }];
  remove: [itemId: number | string];
  indent: [itemId: number | string];
  outdent: [itemId: number | string];
  insertBelow: [itemId: number | string];
}>();

const rowRef = useTemplateRef<HTMLElement>('rowRef');

const { isDragging } = makeDraggable(rowRef, {
  dragHandle: '.drag-handle',
  activation: { distance: 5 }
}, () => [props.index, props.orderedItems]);

const handleItemUpdate = (event: { id: number | string; name: string; checked?: boolean }) => {
  emit('update', event);
};

const handleRemoveItem = (itemId: number | string) => {
  emit('remove', itemId);
};

const handleIndent = (itemId: number | string) => {
  emit('indent', itemId);
};

const handleOutdent = (itemId: number | string) => {
  emit('outdent', itemId);
};

const handleInsertBelow = (itemId: number | string) => {
  emit('insertBelow', itemId);
};
</script>
