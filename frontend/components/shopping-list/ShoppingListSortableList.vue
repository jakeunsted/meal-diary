<template>
  <div
    ref="listRef"
    class="shopping-list-sortable"
    data-testid="shopping-list-sortable-list"
    @pointerdown="handlePointerDown"
  >
    <div
      v-for="itemId in displayOrder"
      :key="String(itemId)"
      class="shopping-list-sortable__row my-1"
      :class="{
        'shopping-list-sortable__row--dragging': draggingId === itemId,
        'z-10 relative': draggingId === itemId,
      }"
      :style="{
        transform: `translateY(${rowTranslateY(itemId)}px)`,
        transition: draggingId ? 'transform 80ms linear' : undefined,
      }"
      data-sortable-row
      :data-sortable-id="itemId"
      :data-testid="`shopping-list-sortable-row-${itemId}`"
    >
      <slot
        :item="itemById.get(itemId)"
        :is-dragging="draggingId === itemId"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ShoppingListItem } from '~/types/ShoppingList';
import { useShoppingListSortable } from '~/composables/useShoppingListSortable';

const props = defineProps<{
  items: ShoppingListItem[];
}>();

const emit = defineEmits<{
  reorder: [orderedIds: Array<number | string>];
}>();

const itemIds = computed(() => props.items.map((item) => item.id));

const itemById = computed(() => {
  const map = new Map<number | string, ShoppingListItem>();
  for (const item of props.items) {
    map.set(item.id, item);
  }
  return map;
});

const {
  listRef,
  draggingId,
  displayOrder,
  rowTranslateY,
  handlePointerDown,
} = useShoppingListSortable({
  itemIds,
  onReorder: (orderedIds) => emit('reorder', orderedIds),
});
</script>

<style scoped>
.shopping-list-sortable__row--dragging {
  opacity: 0.92;
  box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
  background: var(--color-base-100, white);
  border-radius: 0.5rem;
}
</style>
