<template>
  <div class="max-w-4xl mx-auto px-4">
    <div class="flex items-center gap-2 my-4">
      <button class="btn btn-ghost btn-sm" @click="router.push(recipePath)">
        <fa icon="chevron-left" />
        {{ $t('Back') }}
      </button>
    </div>

    <h1 class="text-2xl font-bold mb-4">{{ $t('Edit Recipe') }}</h1>

    <RecipeSyncReviewHost />

    <div v-if="recipeStore.refreshing && recipe" class="flex justify-end mb-2" aria-busy="true">
      <span class="loading loading-spinner loading-sm text-primary" :aria-label="$t('recipeSync.refreshing')" data-testid="recipe-refreshing"></span>
    </div>

    <div v-if="recipeStore.loading && !recipe" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="!recipe" class="py-8 text-center">
      <p class="mb-4">{{ $t('recipeDetail.loadFailed') }}</p>
      <button type="button" class="btn btn-primary btn-sm" data-testid="recipe-retry-button" @click="handleRetry">
        {{ $t('Retry') }}
      </button>
    </div>

    <RecipeForm
      v-else-if="recipe"
      :initialData="recipe"
      :submitLabel="$t('Save Changes')"
      :isLoading="recipeStore.saving"
      @submit="handleUpdate"
      @dirty="handleFormDirty"
      @cancel="router.push(recipePath)"
    >
      <template #categories>
        <RecipeCategoryField
          :model-value="categoryIds"
          :visible-categories="recipeStore.categories"
          :assigned-categories="recipe.categories ?? []"
          @update:model-value="handleCategoryIdsUpdate"
        />
      </template>
    </RecipeForm>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth'
});

import { toRecipeSyncValue } from '@meal-diary/shared';
import { useRecipeStore } from '~/stores/recipe';
import { useUserStore } from '~/stores/user';
import RecipeForm from '~/components/recipe/RecipeForm.vue';
import RecipeCategoryField from '~/components/recipe/RecipeCategoryField.vue';
import RecipeSyncReviewHost from '~/components/recipe/RecipeSyncReviewHost.vue';
import { extractEntitlementError } from '~/utils/httpError';

const route = useRoute();
const router = useRouter();
const recipeStore = useRecipeStore();
const userStore = useUserStore();
const { track } = useAnalytics();
const { openPaywall } = usePaywall();

const recipe = computed(() => recipeStore.currentRecipe);
const categoryIds = ref([]);
const hasEditedCategories = ref(false);
const formDirty = ref(false);
const baseline = ref(null);

if (import.meta.client) {
  recipeStore.hydrateCurrentRecipe(parseInt(route.params.id));
}

const recipePath = computed(() => {
  const fromQuery = route.query.from === 'diary' ? '?from=diary' : '';
  return `/recipes/${route.params.id}${fromQuery}`;
});

watch(recipe, (value) => {
  if (!value || hasEditedCategories.value || formDirty.value) {
    return;
  }
  categoryIds.value = (value.categories ?? []).map((category) => category.id);
  baseline.value = toRecipeSyncValue({
    ...value,
    category_ids: categoryIds.value,
  });
}, { immediate: true });

const handleCategoryIdsUpdate = (ids) => {
  hasEditedCategories.value = true;
  categoryIds.value = ids;
};

const handleFormDirty = () => {
  formDirty.value = true;
};

const handleRetry = () => {
  void recipeStore.fetchRecipeById(parseInt(route.params.id));
};

const handleUpdate = async (formData) => {
  try {
    await recipeStore.updateRecipe(parseInt(route.params.id), {
      ...formData,
      category_ids: categoryIds.value,
    }, baseline.value);
    track('recipe_edited');
    router.push(recipePath.value);
  } catch (error) {
    const entitlementError = extractEntitlementError(error);
    if (entitlementError?.feature === 'custom_recipe_categories') {
      openPaywall('custom_recipe_categories');
      return;
    }
    console.error('Error updating recipe:', error);
  }
};

onMounted(async () => {
  if (!userStore.user?.family_group_id) {
    await userStore.fetchUser();
  }
  recipeStore.hydrateCurrentRecipe(parseInt(route.params.id));
  await Promise.all([
    recipeStore.fetchRecipeById(parseInt(route.params.id)),
    recipeStore.fetchCategories().catch((error) => {
      console.error('Error loading recipe categories:', error);
    }),
  ]);
});
</script>
