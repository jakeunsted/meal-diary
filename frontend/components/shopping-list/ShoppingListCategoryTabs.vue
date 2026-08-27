<template>
  <div
    class="tabs tabs-box tabs-sm w-full overflow-x-auto flex-nowrap mb-3"
    role="tablist"
    data-testid="shopping-list-category-tabs"
  >
    <button
      v-for="tab in tabs"
      :key="tab"
      type="button"
      role="tab"
      class="tab shrink-0"
      :class="{ 'tab-active': modelValue === tab }"
      :data-testid="`shopping-list-tab-${tab}`"
      :aria-selected="modelValue === tab"
      @click="handleSelect(tab)"
    >
      <span>{{ tabLabel(tab) }}</span>
      <span
        v-if="counts[tab]"
        class="badge badge-sm badge-ghost ml-1"
        :data-testid="`shopping-list-tab-count-${tab}`"
      >
        {{ counts[tab] }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  SHOPPING_LIST_TABS,
  type ShoppingListTab,
} from '@meal-diary/shared';

const props = defineProps<{
  modelValue: ShoppingListTab;
  counts: Record<ShoppingListTab, number>;
}>();

const emit = defineEmits<{
  'update:modelValue': [tab: ShoppingListTab];
}>();

const { t } = useI18n();

const tabs = SHOPPING_LIST_TABS;

const tabLabel = (tab: ShoppingListTab): string => {
  switch (tab) {
    case 'all':
      return t('All');
    case 'meat':
      return t('Meat');
    case 'fruit_veg':
      return t('Fruit & Veg');
    case 'bakery':
      return t('Bakery');
    case 'canned':
      return t('Canned');
    case 'other':
      return t('Other');
    default:
      return tab;
  }
};

const handleSelect = (tab: ShoppingListTab) => {
  emit('update:modelValue', tab);
};
</script>
