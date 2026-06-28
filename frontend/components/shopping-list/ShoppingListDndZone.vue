<template>
  <div
    ref="listZoneRef"
    class="min-h-[2rem] flex flex-col"
    data-testid="shopping-list-active-items"
  >
    <ShoppingListDraggableRow
      v-for="(item, index) in activeItems"
      :key="item.id"
      :item="item"
      :index="index"
      :ordered-items="activeItems"
      :depth="displayDepthMap[item.id] || 0"
      :preview-order="previewOrderById[item.id] ?? index"
      :preview-active="isPreviewActive"
      :is-preview-nest-target="previewNestTargetId === item.id"
      :is-preview-placeholder="isPreviewActive && previewDraggedIds.has(item.id)"
      @update="$emit('update', $event)"
      @remove="$emit('remove', $event)"
      @indent="$emit('indent', $event)"
      @outdent="$emit('outdent', $event)"
      @insertBelow="$emit('insertBelow', $event)"
      @drag-preview="handleDragPreview"
    />
  </div>
</template>

<script setup lang="ts">
import { makeDroppable, useDnDProvider } from '@vue-dnd-kit/core';
import type { IDragEvent } from '@vue-dnd-kit/core';
import ShoppingListDraggableRow from '~/components/shopping-list/ShoppingListDraggableRow.vue';
import { useShoppingListStore } from '~/stores/shoppingList';
import {
  applyShoppingListDropHierarchy,
  buildShoppingListDepthMap,
  shouldNestShoppingListItem,
} from '~/utils/shoppingListDrop';
import type { ShoppingListItem } from '~/types/ShoppingList';

const props = defineProps<{
  activeItems: ShoppingListItem[];
  itemDepthMap: Record<string | number, number>;
}>();

defineEmits<{
  update: [event: { id: number | string; name: string; checked?: boolean }];
  remove: [itemId: number | string];
  indent: [itemId: number | string];
  outdent: [itemId: number | string];
  insertBelow: [itemId: number | string];
}>();

const listZoneRef = useTemplateRef<HTMLElement>('listZoneRef');
const shoppingListStore = useShoppingListStore();
const { state: dndState } = useDnDProvider();

const previewFlatItems = ref<ShoppingListItem[] | null>(null);
const previewNestTargetId = ref<number | string | null>(null);
const previewDraggedIds = ref<Set<number | string>>(new Set());

const isPreviewActive = computed(() => previewFlatItems.value !== null);

const previewOrderById = computed(() => {
  const items = previewFlatItems.value ?? props.activeItems;
  const orderById: Record<string | number, number> = {};

  items.forEach((item, index) => {
    orderById[item.id] = index;
  });

  return orderById;
});

const displayDepthMap = computed(() => {
  if (!previewFlatItems.value) {
    return props.itemDepthMap;
  }

  return buildShoppingListDepthMap(previewFlatItems.value);
});

const checkedItems = computed(() => {
  if (!shoppingListStore.shoppingList?.items) {
    return [];
  }
  return shoppingListStore.shoppingList.items.filter(item => item.checked);
});

const clearDragPreview = () => {
  previewFlatItems.value = null;
  previewNestTargetId.value = null;
  previewDraggedIds.value = new Set();
};

const handleDragPreview = (event: IDragEvent) => {
  if (dndState.value !== 'dragging') {
    return;
  }

  const result = event.helpers.suggestSort('vertical');
  if (!result || !result.sameList) {
    clearDragPreview();
    return;
  }

  const draggedIds = new Set(
    result.draggedItems.map((item) => (item as ShoppingListItem).id)
  );
  const hovered = event.hoveredDraggable;
  const hoveredItem = hovered ? hovered.item as ShoppingListItem : null;
  const nestAsChild = shouldNestShoppingListItem(event);

  previewDraggedIds.value = draggedIds;
  previewNestTargetId.value = nestAsChild && hoveredItem ? hoveredItem.id : null;
  previewFlatItems.value = applyShoppingListDropHierarchy(
    result.targetItems as ShoppingListItem[],
    draggedIds,
    hoveredItem,
    nestAsChild,
    shoppingListStore.shoppingList?.items ?? []
  );
};

const applyDropResult = async (
  flatActiveItems: ShoppingListItem[],
  draggedIds: Set<number | string>,
  hoveredItem: ShoppingListItem | null,
  nestAsChild: boolean
) => {
  const allItems = shoppingListStore.shoppingList?.items ?? [];
  const updatedItems = applyShoppingListDropHierarchy(
    flatActiveItems,
    draggedIds,
    hoveredItem,
    nestAsChild,
    allItems
  );

  shoppingListStore.applyActiveFlatOrder(updatedItems);

  checkedItems.value.forEach((item, index) => {
    shoppingListStore.recordReorder({
      id: item.id,
      parent_item_id: item.parent_item_id ?? null,
      position: index,
    });
  });

  shoppingListStore.scheduleSaveToLocalStorage();
  await shoppingListStore.syncPendingChanges();
};

watch(() => dndState.value, (state) => {
  if (state !== 'dragging') {
    clearDragPreview();
  }
});

makeDroppable(listZoneRef, {
  events: {
    onEnter: handleDragPreview,
    onDrop: async (event) => {
      const result = event.helpers.suggestSort('vertical');
      if (!result || !result.sameList) {
        clearDragPreview();
        return;
      }

      const draggedIds = new Set(result.draggedItems.map((item) => item.id));
      const hovered = event.hoveredDraggable;
      const hoveredItem = hovered ? hovered.item as ShoppingListItem : null;
      const nestAsChild = shouldNestShoppingListItem(event);

      await applyDropResult(
        result.targetItems as ShoppingListItem[],
        draggedIds,
        hoveredItem,
        nestAsChild
      );
      clearDragPreview();
    },
    onLeave: () => {
      if (dndState.value !== 'dragging') {
        clearDragPreview();
      }
    },
  }
}, () => props.activeItems);
</script>
