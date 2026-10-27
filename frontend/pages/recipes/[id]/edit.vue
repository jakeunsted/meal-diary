<template>
  <div class="max-w-4xl mx-auto px-4">
    <div class="flex items-center gap-2 my-4">
      <button class="btn btn-ghost btn-sm" @click="router.push(recipePath)">
        <fa icon="chevron-left" />
        {{ $t('Back') }}
      </button>
    </div>

    <h1 class="text-2xl font-bold mb-4">{{ $t('Edit Recipe') }}</h1>

    <div v-if="recipeStore.loading && !recipe" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <RecipeForm
      v-else-if="recipe"
      :initialData="recipe"
      :submitLabel="$t('Save Changes')"
      :isLoading="recipeStore.loading"
      @submit="handleUpdate"
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

import { useRecipeStore } from '~/stores/recipe';
import { useUserStore } from '~/stores/user';
import RecipeForm from '~/components/recipe/RecipeForm.vue';
import RecipeCategoryField from '~/components/recipe/RecipeCategoryField.vue';
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

const recipePath = computed(() => {
  const fromQuery = route.query.from === 'diary' ? '?from=diary' : '';
  return `/recipes/${route.params.id}${fromQuery}`;
});

watch(recipe, (value) => {
  if (!value || hasEditedCategories.value) {
    return;
  }
  categoryIds.value = (value.categories ?? []).map((category) => category.id);
}, { immediate: true });

const handleCategoryIdsUpdate = (ids) => {
  hasEditedCategories.value = true;
  categoryIds.value = ids;
};

const handleUpdate = async (formData) => {
  try {
    await recipeStore.updateRecipe(parseInt(route.params.id), {
      ...formData,
      category_ids: categoryIds.value,
    });
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
  await Promise.all([
    recipeStore.fetchRecipeById(parseInt(route.params.id)),
    recipeStore.fetchCategories().catch((error) => {
      console.error('Error loading recipe categories:', error);
    }),
  ]);
});
</script>
