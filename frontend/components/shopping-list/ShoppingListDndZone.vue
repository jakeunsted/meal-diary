<template>
  <div
    ref="listZoneRef"
    class="min-h-[2rem]"
  >
    <ShoppingListDraggableRow
      v-for="(item, index) in activeItems"
      :key="item.id"
      :item="item"
      :index="index"
      :ordered-items="activeItems"
      :depth="itemDepthMap[item.id] || 0"
      @update="$emit('update', $event)"
      @remove="$emit('remove', $event)"
      @indent="$emit('indent', $event)"
      @outdent="$emit('outdent', $event)"
      @insertBelow="$emit('insertBelow', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { makeDroppable } from '@vue-dnd-kit/core';
import ShoppingListDraggableRow from '~/components/shopping-list/ShoppingListDraggableRow.vue';
import { useShoppingListStore } from '~/stores/shoppingList';
import type { ShoppingListItem } from '~/types/ShoppingList';

const props = defineProps<{
  activeItems: ShoppingListItem[];
  itemDepthMap: Record<string | number, number>;
}>();

const emit = defineEmits<{
  update: [event: { id: number | string; name: string; checked?: boolean }];
  remove: [itemId: number | string];
  indent: [itemId: number | string];
  outdent: [itemId: number | string];
  insertBelow: [itemId: number | string];
}>();

const listZoneRef = useTemplateRef<HTMLElement>('listZoneRef');
const shoppingListStore = useShoppingListStore();

const checkedItems = computed(() => {
  if (!shoppingListStore.shoppingList?.items) {
    return [];
  }
  return shoppingListStore.shoppingList.items.filter(item => item.checked);
});

makeDroppable(listZoneRef, {
  events: {
    onDrop(event) {
      const result = event.helpers.suggestSort('vertical');
      if (!result || !result.sameList) {
        return;
      }
      const newActiveOrder = result.targetItems as ShoppingListItem[];
      newActiveOrder.forEach((item, i) => {
        shoppingListStore.recordReorder({
          id: item.id,
          parent_item_id: item.parent_item_id ?? null,
          position: i
        });
      });
      checkedItems.value.forEach((item, j) => {
        shoppingListStore.recordReorder({
          id: item.id,
          parent_item_id: item.parent_item_id ?? null,
          position: newActiveOrder.length + j
        });
      });
      shoppingListStore.syncPendingChanges();
    }
  }
}, () => props.activeItems);
</script>
