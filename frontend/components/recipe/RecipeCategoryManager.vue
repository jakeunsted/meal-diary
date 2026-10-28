<template>
  <div class="modal-box max-w-lg" data-testid="recipe-category-manager-panel">
    <h3 class="font-bold text-lg">{{ t('recipesPage.categories.manage') }}</h3>
    <div class="alert alert-info mt-3 py-2 text-sm">
      <span>{{ t('recipesPage.categories.sharedNotice') }}</span>
    </div>
    <p class="mt-3 text-sm text-base-content/70">{{ t('recipesPage.categories.startersFixed') }}</p>

    <div v-if="categoryPendingDelete" class="mt-4 space-y-3" data-testid="recipe-category-delete-confirm-panel">
      <h4 class="font-semibold">{{ t('recipesPage.categories.deleteTitle', { name: categoryPendingDelete.name }) }}</h4>
      <p>{{ t('recipesPage.categories.deleteBody', { name: categoryPendingDelete.name }) }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" @click="handleCancelDelete">
          {{ t('Cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-error"
          data-testid="recipe-category-delete-confirm"
          :disabled="isSaving"
          @click="handleConfirmDelete"
        >
          <span v-if="isSaving" class="loading loading-spinner loading-sm"></span>
          <span v-else>{{ t('recipesPage.categories.delete') }}</span>
        </button>
      </div>
    </div>

    <template v-else>
      <ul class="mt-4 flex flex-col gap-2" data-testid="recipe-category-manager-list">
        <li
          v-for="category in starterCategories"
          :key="category.id"
          class="rounded-lg border border-base-300 px-3 py-2"
          :data-testid="`recipe-category-starter-${category.id}`"
        >
          {{ category.name }}
        </li>
        <li
          v-for="category in customCategories"
          :key="category.id"
          class="flex items-center justify-between gap-2 rounded-lg border border-base-300 px-3 py-2"
          :data-testid="`recipe-category-custom-${category.id}`"
        >
          <span>{{ category.name }}</span>
          <div v-if="canUseCustom" class="flex gap-1">
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              :data-testid="`recipe-category-rename-${category.id}`"
              @click="handleStartRename(category)"
            >
              {{ t('recipesPage.categories.rename') }}
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-xs text-error"
              :data-testid="`recipe-category-delete-${category.id}`"
              @click="handleStartDelete(category)"
            >
              {{ t('recipesPage.categories.delete') }}
            </button>
          </div>
        </li>
      </ul>

      <div
        v-if="!canUseCustom"
        class="alert alert-warning mt-4 py-2 text-sm"
        data-testid="recipe-category-lapsed-note"
      >
        <span>{{ t('recipesPage.categories.lapsedNote') }}</span>
      </div>

      <div v-if="nameMode" class="mt-4 space-y-2">
        <label class="form-control">
          <span class="label-text font-semibold">{{ t('recipesPage.categories.nameLabel') }}</span>
          <input
            v-model="draftName"
            type="text"
            class="input input-bordered w-full"
            data-testid="recipe-category-name-input"
            @keydown.enter.prevent="handleSaveName"
          />
        </label>
        <p v-if="nameMode === 'rename'" class="text-sm text-base-content/70">
          {{ t('recipesPage.categories.renameNotice') }}
        </p>
        <p v-if="nameError" class="text-error text-sm" role="alert" data-testid="recipe-category-name-error">
          {{ nameError }}
        </p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" @click="handleCancelName">
            {{ t('Cancel') }}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            data-testid="recipe-category-name-submit"
            :disabled="isSaving"
            @click="handleSaveName"
          >
            <span v-if="isSaving" class="loading loading-spinner loading-sm"></span>
            <span v-else>{{ t('Save') }}</span>
          </button>
        </div>
      </div>

      <div class="modal-action">
        <button
          v-if="!nameMode"
          type="button"
          class="btn btn-primary"
          data-testid="recipe-category-add"
          @click="handleStartAdd"
        >
          {{ t('recipesPage.categories.add') }}
        </button>
        <button type="button" class="btn btn-ghost" data-testid="recipe-category-manager-close" @click="handleClose">
          {{ t('Close') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { recipeCategoryNameError } from '@meal-diary/shared';
import { useRecipeStore } from '~/stores/recipe';
import type { RecipeCategory } from '~/types/Recipe';
import { extractEntitlementError } from '~/utils/httpError';

const emit = defineEmits<{
  close: [];
}>();

const recipeStore = useRecipeStore();
const { t } = useI18n();
const { hasFeature } = useEntitlements();
const { openPaywall } = usePaywall();

const canUseCustom = hasFeature('custom_recipe_categories');
const nameMode = ref<'add' | 'rename' | null>(null);
const renamingCategory = ref<RecipeCategory | null>(null);
const categoryPendingDelete = ref<RecipeCategory | null>(null);
const draftName = ref('');
const nameError = ref('');
const isSaving = ref(false);

const starterCategories = computed(() =>
  recipeStore.categories.filter((category) => category.is_default)
);

const customCategories = computed(() => {
  if (!canUseCustom.value) {
    return [];
  }
  return recipeStore.categories.filter((category) => !category.is_default);
});

const readErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const record = error as {
    code?: string;
    data?: { code?: string; data?: { code?: string } };
  };
  return record.data?.data?.code ?? record.data?.code ?? record.code ?? null;
};

const categoryErrorCopy = (code: string | null): string | null => {
  switch (code) {
    case 'empty':
      return t('recipesPage.categories.nameEmpty');
    case 'too_long':
      return t('recipesPage.categories.nameTooLong');
    case 'duplicate':
      return t('recipesPage.categories.nameDuplicate');
    case 'emoji':
    case 'control_chars':
      return t('recipesPage.categories.nameInvalid');
    case 'default_category_locked':
      return t('recipesPage.categories.startersFixed');
    default:
      return null;
  }
};

const handleClose = () => {
  emit('close');
};

const handleStartAdd = () => {
  if (!canUseCustom.value) {
    openPaywall('custom_recipe_categories');
    emit('close');
    return;
  }
  nameMode.value = 'add';
  renamingCategory.value = null;
  draftName.value = '';
  nameError.value = '';
};

const handleStartRename = (category: RecipeCategory) => {
  if (!canUseCustom.value) {
    openPaywall('custom_recipe_categories');
    return;
  }
  nameMode.value = 'rename';
  renamingCategory.value = category;
  draftName.value = category.name;
  nameError.value = '';
};

const handleCancelName = () => {
  nameMode.value = null;
  renamingCategory.value = null;
  draftName.value = '';
  nameError.value = '';
};

const handleStartDelete = (category: RecipeCategory) => {
  if (!canUseCustom.value) {
    openPaywall('custom_recipe_categories');
    return;
  }
  categoryPendingDelete.value = category;
  nameMode.value = null;
  nameError.value = '';
};

const handleCancelDelete = () => {
  categoryPendingDelete.value = null;
};

const handleSaveName = async () => {
  if (!canUseCustom.value) {
    openPaywall('custom_recipe_categories');
    return;
  }

  const existingNames = recipeStore.categories
    .filter((category) => nameMode.value !== 'rename' || category.id !== renamingCategory.value?.id)
    .map((category) => category.name);
  const copy = categoryErrorCopy(recipeCategoryNameError(draftName.value, existingNames));
  if (copy) {
    nameError.value = copy;
    return;
  }

  nameError.value = '';
  isSaving.value = true;
  try {
    if (nameMode.value === 'rename' && renamingCategory.value) {
      await recipeStore.renameCategory(renamingCategory.value.id, draftName.value);
    } else {
      await recipeStore.createCategory(draftName.value);
    }
    handleCancelName();
  } catch (error) {
    const entitlementError = extractEntitlementError(error);
    if (entitlementError?.feature === 'custom_recipe_categories') {
      openPaywall('custom_recipe_categories');
      return;
    }
    nameError.value = categoryErrorCopy(readErrorCode(error)) ?? '';
    if (!nameError.value) {
      console.error('Error saving recipe category:', error);
    }
  } finally {
    isSaving.value = false;
  }
};

const handleConfirmDelete = async () => {
  if (!categoryPendingDelete.value) {
    return;
  }
  if (!canUseCustom.value) {
    openPaywall('custom_recipe_categories');
    return;
  }

  isSaving.value = true;
  try {
    await recipeStore.deleteCategory(categoryPendingDelete.value.id);
    categoryPendingDelete.value = null;
  } catch (error) {
    const entitlementError = extractEntitlementError(error);
    if (entitlementError?.feature === 'custom_recipe_categories') {
      openPaywall('custom_recipe_categories');
      return;
    }
    console.error('Error deleting recipe category:', error);
  } finally {
    isSaving.value = false;
  }
};
</script>
