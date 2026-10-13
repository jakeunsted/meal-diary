<template>
  <div data-testid="shopping-list-compact">
    <div data-testid="shopping-list-active-items">
      <template v-if="activeTab === 'all'">
        <div
          v-for="category in categories"
          :key="category"
          class="mb-4"
        >
          <template v-if="activeItemsByCategory[category].length">
            <h3
              class="text-sm font-semibold uppercase tracking-wide opacity-70 px-2 mb-1"
              :data-testid="`shopping-list-section-${category}`"
            >
              {{ categoryLabel(category) }}
            </h3>
            <ShoppingListRows
              :items="activeItemsByCategory[category]"
              :hide-checkbox="hideCheckboxes"
              @reorder="(ids) => handleReorder(category, ids)"
              @update="handleItemUpdate"
              @remove="handleRemoveItem"
              @insert-below="handleInsertBelow"
              @move-category="handleMoveCategory"
            />
          </template>
        </div>
      </template>

      <ShoppingListRows
        v-else
        :items="activeItemsForTab"
        :hide-checkbox="hideCheckboxes"
        @reorder="(ids) => handleReorder(activeTab, ids)"
        @update="handleItemUpdate"
        @remove="handleRemoveItem"
        @insert-below="handleInsertBelow"
        @move-category="handleMoveCategory"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import ShoppingListRows from '~/components/shopping-list/ShoppingListRows.vue';

const {
  activeTab,
  categories,
  activeItemsByCategory,
  categoryLabel,
  hideCheckboxes,
  handleReorder,
  handleItemUpdate,
  handleRemoveItem,
  handleInsertBelow,
  handleMoveCategory,
  activeItemsForTab,
} = useShoppingListScreenContext();
</script>
