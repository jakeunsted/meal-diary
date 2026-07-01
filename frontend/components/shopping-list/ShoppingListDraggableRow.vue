<template>
  <div
    ref="rowRef"
    class="my-1 relative"
    :class="rowClasses"
    :style="rowStyle"
    :data-testid="`shopping-list-item-row-${item.id}`"
  >
    <div
      v-if="isDragOver?.top"
      class="pointer-events-none absolute left-0 right-0 top-0 h-0.5 bg-primary rounded-full z-10"
      aria-hidden="true"
    />
    <div
      v-if="isDragOver?.bottom"
      class="pointer-events-none absolute left-0 right-0 bottom-0 h-0.5 bg-primary rounded-full z-10"
      aria-hidden="true"
    />
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
import type { IDragEvent } from '@vue-dnd-kit/core';
import type { ShoppingListItem as ShoppingListItemType } from '~/types/ShoppingList';

const props = defineProps<{
  item: ShoppingListItemType;
  index: number;
  orderedItems: ShoppingListItemType[];
  depth: number;
  previewOrder?: number;
  previewActive?: boolean;
  isPreviewNestTarget?: boolean;
  isPreviewPlaceholder?: boolean;
}>();

const emit = defineEmits<{
  update: [event: { id: number | string; name: string; checked?: boolean }];
  remove: [itemId: number | string];
  indent: [itemId: number | string];
  outdent: [itemId: number | string];
  insertBelow: [itemId: number | string];
  dragPreview: [event: IDragEvent];
}>();

const rowRef = useTemplateRef<HTMLElement>('rowRef');

const handleDragPreview = (event: IDragEvent) => {
  emit('dragPreview', event);
};

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

const { isDragOver } = makeDraggable(rowRef, {
  dragHandle: '.drag-handle',
  activation: { distance: 5 },
  placementMargins: {
    left: 0,
    right: 0,
    top: 8,
    bottom: 8,
  },
  events: {
    onHover: handleDragPreview,
    onSelfDragMove: handleDragPreview,
  },
}, () => [props.index, props.orderedItems]);

const rowStyle = computed(() => ({
  marginLeft: `${props.depth * 1.5}rem`,
  order: props.previewOrder,
}));

const rowClasses = computed(() => ({
  'transition-[opacity,margin,transform] duration-200 ease-out': props.previewActive,
  'opacity-40 border border-dashed border-primary/50 bg-primary/10 rounded-lg': props.isPreviewPlaceholder,
  'ring-2 ring-primary/30 rounded-lg': props.isPreviewNestTarget,
}));
</script>
