<template>
  <fieldset class="form-control" data-testid="recipe-category-field">
    <legend class="label-text font-semibold mb-2">{{ t('recipesPage.categories.fieldLabel') }}</legend>
    <div class="flex flex-col gap-2">
      <label
        v-for="category in selectableCategories"
        :key="category.id"
        class="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300 px-3 py-2"
        :data-testid="`recipe-category-option-${category.id}`"
      >
        <input
          type="checkbox"
          class="checkbox checkbox-sm checkbox-primary"
          :checked="modelValue.includes(category.id)"
          @change="handleToggle(category, $event)"
        />
        <span>{{ category.name }}</span>
      </label>
      <div
        v-for="category in lockedCategories"
        :key="category.id"
        class="flex flex-wrap items-center gap-2 rounded-lg border border-base-300 px-3 py-2"
        :data-testid="`recipe-category-locked-${category.id}`"
      >
        <span class="font-medium">{{ category.name }}</span>
        <span class="text-sm text-base-content/70">{{ t('recipesPage.categories.assignedLocked') }}</span>
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          :data-testid="`recipe-category-remove-${category.id}`"
          @click="handleRemoveLocked(category.id)"
        >
          {{ t('recipesPage.categories.remove') }}
        </button>
      </div>
      <button
        v-if="!canUseCustom"
        type="button"
        class="btn btn-outline btn-sm self-start"
        data-testid="recipe-category-add-custom"
        @click="handleAddCustom"
      >
        {{ t('recipesPage.categories.addCustom') }}
      </button>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import type { RecipeCategory } from '~/types/Recipe';

const props = defineProps<{
  modelValue: number[];
  visibleCategories: RecipeCategory[];
  assignedCategories: RecipeCategory[];
}>();

const emit = defineEmits<{
  'update:modelValue': [categoryIds: number[]];
}>();

const { t } = useI18n();
const { hasFeature } = useEntitlements();
const { openPaywall } = usePaywall();

const canUseCustom = hasFeature('custom_recipe_categories');

const selectableCategories = computed(() =>
  props.visibleCategories.filter((category) => category.is_default || canUseCustom.value)
);

const lockedCategories = computed(() =>
  props.assignedCategories.filter(
    (category) => category.assignable === false && props.modelValue.includes(category.id)
  )
);

const handleToggle = (category: RecipeCategory, event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!category.is_default && !canUseCustom.value) {
    input.checked = props.modelValue.includes(category.id);
    openPaywall('custom_recipe_categories');
    return;
  }

  const next = new Set(props.modelValue);
  if (input.checked) {
    next.add(category.id);
  } else {
    next.delete(category.id);
  }
  emit('update:modelValue', [...next]);
};

const handleRemoveLocked = (categoryId: number) => {
  emit('update:modelValue', props.modelValue.filter((id) => id !== categoryId));
};

const handleAddCustom = () => {
  openPaywall('custom_recipe_categories');
};
</script>
