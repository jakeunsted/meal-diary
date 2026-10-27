<template>
  <div
    class="tabs tabs-box tabs-sm w-full overflow-x-auto flex-nowrap mb-3"
    role="tablist"
    data-testid="recipe-category-tabs"
  >
    <button
      type="button"
      role="tab"
      class="tab shrink-0"
      :class="{ 'tab-active': modelValue.kind === 'all' }"
      data-testid="recipe-category-tab-all"
      :aria-selected="modelValue.kind === 'all'"
      @click="handleSelectAll"
    >
      <span>{{ t('recipesPage.categories.all') }}</span>
      <span class="badge badge-sm badge-ghost ml-1" data-testid="recipe-category-tab-count-all">{{ counts.all }}</span>
    </button>
    <button
      v-for="category in categories"
      :key="category.id"
      type="button"
      role="tab"
      class="tab shrink-0"
      :class="{ 'tab-active': isCategorySelected(category.id) }"
      :data-testid="`recipe-category-tab-${category.id}`"
      :aria-selected="isCategorySelected(category.id)"
      @click="handleSelectCategory(category.id)"
    >
      <span>{{ category.name }}</span>
      <span class="badge badge-sm badge-ghost ml-1" :data-testid="`recipe-category-tab-count-${category.id}`">{{ counts.byId[category.id] ?? 0 }}</span>
    </button>
    <button
      type="button"
      role="tab"
      class="tab shrink-0"
      :class="{ 'tab-active': modelValue.kind === 'uncategorized' }"
      data-testid="recipe-category-tab-uncategorized"
      :aria-selected="modelValue.kind === 'uncategorized'"
      @click="handleSelectUncategorized"
    >
      <span>{{ t('recipesPage.categories.uncategorized') }}</span>
      <span class="badge badge-sm badge-ghost ml-1" data-testid="recipe-category-tab-count-uncategorized">{{ counts.uncategorized }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { RecipeCategoryFilter, RecipeCategoryTabCounts } from '@meal-diary/shared';
import type { RecipeCategory } from '~/types/Recipe';

const props = defineProps<{
  modelValue: RecipeCategoryFilter;
  categories: RecipeCategory[];
  counts: RecipeCategoryTabCounts;
}>();

const emit = defineEmits<{
  'update:modelValue': [filter: RecipeCategoryFilter];
}>();

const { t } = useI18n();

const isCategorySelected = (categoryId: number) =>
  props.modelValue.kind === 'category' && props.modelValue.categoryId === categoryId;

const handleSelectAll = () => {
  emit('update:modelValue', { kind: 'all' });
};

const handleSelectCategory = (categoryId: number) => {
  emit('update:modelValue', { kind: 'category', categoryId });
};

const handleSelectUncategorized = () => {
  emit('update:modelValue', { kind: 'uncategorized' });
};
</script>
