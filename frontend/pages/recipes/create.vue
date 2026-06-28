<template>
  <div class="max-w-4xl mx-auto px-4">
    <div class="flex items-center gap-2 my-4">
      <button class="btn btn-ghost btn-sm" @click="router.push('/recipes')">
        <fa icon="chevron-left" />
        {{ $t('Back') }}
      </button>
    </div>

    <h1 class="text-2xl font-bold mb-4">{{ $t('New Recipe') }}</h1>

    <div
      v-if="!canCreateRecipe"
      class="alert alert-warning mb-4"
      role="alert"
      data-testid="recipe-create-limit-alert"
    >
      <div class="flex flex-col gap-2 w-full">
        <span>{{ $t('recipesPage.limitReached') }}</span>
        <NuxtLink class="btn btn-primary btn-sm w-fit" to="/plans">
          {{ $t('recipesPage.upgradeLink') }}
        </NuxtLink>
      </div>
    </div>

    <RecipeForm
      v-else
      :submitLabel="$t('Create Recipe')"
      :isLoading="recipeStore.loading"
      @submit="handleCreate"
      @cancel="router.push('/recipes')"
    />
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth'
});

import { useRecipeStore } from '~/stores/recipe';
import { useUserStore } from '~/stores/user';
import RecipeForm from '~/components/recipe/RecipeForm.vue';
import { extractEntitlementError } from '~/utils/httpError';

const router = useRouter();
const recipeStore = useRecipeStore();
const userStore = useUserStore();
const { track } = useAnalytics();
const { hasFeature, refreshEntitlements } = useEntitlements();
const { openPaywall } = usePaywall();

const canCreateRecipe = hasFeature('recipes');

const handleCreate = async (formData) => {
  if (!canCreateRecipe.value) {
    openPaywall('recipes');
    return;
  }

  try {
    const recipe = await recipeStore.createRecipe(formData);
    if (recipe) {
      track('recipe_created');
      router.push(`/recipes/${recipe.id}`);
    }
  } catch (error) {
    const entitlementError = extractEntitlementError(error);
    if (entitlementError?.feature === 'recipes') {
      openPaywall('recipes');
      return;
    }

    console.error('Error creating recipe:', error);
  }
};

onMounted(async () => {
  if (!userStore.user?.family_group_id) {
    await userStore.fetchUser();
  }

  await refreshEntitlements();
});
</script>
