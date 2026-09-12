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
        'shopping-list-sortable__row--shifting': draggingId != null && draggingId !== itemId,
      }"
      :style="{
        transform: `translateY(${rowTranslateY(itemId)}px)`,
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
.shopping-list-sortable__row {
  will-change: transform;
}

.shopping-list-sortable__row--shifting {
  transition: transform 120ms ease;
}

.shopping-list-sortable__row--dragging {
  position: relative;
  z-index: 20;
  opacity: 0.96;
  box-shadow: 0 8px 20px rgb(0 0 0 / 18%);
  background: var(--color-base-100, white);
  border-radius: 0.5rem;
  /* No transform transition — the row must stay glued to the pointer. */
  transition: box-shadow 120ms ease, opacity 120ms ease;
  touch-action: none;
}
</style>
