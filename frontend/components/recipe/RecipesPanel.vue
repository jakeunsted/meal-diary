<template>
  <div class="h-full min-h-0 overflow-y-auto px-3 py-3" :data-testid="`recipes-panel-${variant}`">
    <h2 class="text-lg font-bold mb-3">{{ $t('Recipe Book') }}</h2>

    <div
      v-if="recipeUsageLabel"
      class="text-sm text-base-content/70 mb-2"
      data-testid="recipes-usage-label"
    >
      {{ recipeUsageLabel }}
    </div>

    <div
      v-if="!canCreateRecipe"
      class="alert alert-warning mb-4"
      role="alert"
      data-testid="recipes-limit-alert"
    >
      <div class="flex flex-col gap-2 w-full">
        <span>{{ $t('recipesPage.limitReached') }}</span>
        <span class="text-sm">{{ recipeLimitHelperText }}</span>
        <NuxtLink
          v-if="billing.isOwner"
          class="btn btn-primary btn-sm w-fit"
          to="/plans"
        >
          {{ $t('recipesPage.upgradeLink') }}
        </NuxtLink>
      </div>
    </div>

    <div class="flex gap-2 mb-4">
      <div class="relative flex-1">
        <fa icon="magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
        <input
          type="text"
          class="input input-bordered w-full pl-10"
          data-testid="recipes-search-input"
          :placeholder="$t('Search recipes...')"
          v-model="searchQuery"
          @input="handleSearch"
        />
      </div>
      <button
        class="btn btn-primary"
        data-testid="recipes-new-button"
        :disabled="!canCreateRecipe"
        @click="handleCreateRecipe"
      >
        <fa icon="plus" />
        <span class="hidden sm:inline">{{ $t('New Recipe') }}</span>
      </button>
    </div>

    <div v-if="recipeStore.loading && recipes.length === 0" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="recipeStore.recipes.length === 0" class="text-center py-12">
      <fa icon="book-open" class="text-5xl text-base-content/30 mb-4" />
      <p class="text-lg font-medium">{{ $t('No recipes yet') }}</p>
      <p class="text-base-content/60 mb-4">{{ $t('Create your first recipe to get started!') }}</p>
      <button class="btn btn-primary" :disabled="!canCreateRecipe" @click="handleCreateRecipe">
        <fa icon="plus" class="mr-1" />
        {{ $t('New Recipe') }}
      </button>
    </div>

    <div v-else-if="recipes.length === 0" class="text-center py-12">
      <p class="text-lg font-medium">{{ $t('No recipes found') }}</p>
      <p class="text-base-content/60">{{ $t('Try a different search term') }}</p>
    </div>

    <RecipesWide v-else-if="variant === 'wide'" :recipes="recipes" @open="handleOpenRecipe" />
    <RecipesCompact v-else :recipes="recipes" @open="handleOpenRecipe" />
  </div>
</template>

<script setup lang="ts">
import { useRecipeStore } from '~/stores/recipe';
import { useUserStore } from '~/stores/user';
import RecipesCompact from '~/components/recipe/RecipesCompact.vue';
import RecipesWide from '~/components/recipe/RecipesWide.vue';

defineProps<{
  variant: 'compact' | 'wide';
}>();

const recipeStore = useRecipeStore();
const userStore = useUserStore();
const router = useRouter();
const { t } = useI18n();
const {
  hasFeature,
  entitlements,
  billing,
  refreshEntitlements,
} = useEntitlements();
const { openPaywall } = usePaywall();

const searchQuery = ref('');
const canCreateRecipe = hasFeature('recipes');

const recipeUsageLabel = computed(() => {
  const usage = entitlements.value?.usage.recipeCount ?? 0;
  const maxRecipes = entitlements.value?.limits.maxRecipes;

  if (maxRecipes === undefined) {
    return null;
  }

  if (!Number.isFinite(maxRecipes)) {
    return t('recipesPage.usageUnlimited', { count: usage });
  }

  return t('recipesPage.usageLabel', { count: usage, max: maxRecipes });
});

const recipeLimitHelperText = computed(() => {
  if (billing.value.isOwner) {
    return t('recipesPage.upgradeLink');
  }

  if (billing.value.ownerDisplayName) {
    return t('recipesPage.askOwnerToUpgrade', { name: billing.value.ownerDisplayName });
  }

  return t('recipesPage.askOwnerToUpgradeGeneric');
});

const handleCreateRecipe = () => {
  if (!canCreateRecipe.value) {
    openPaywall('recipes');
    return;
  }

  router.push('/recipes/create');
};

const recipes = computed(() => {
  if (!searchQuery.value) return recipeStore.recipes;
  const query = searchQuery.value.toLowerCase();
  return recipeStore.recipes.filter(recipe =>
    recipe.name.toLowerCase().includes(query)
  );
});

const handleSearch = () => {
  recipeStore.setSearchQuery(searchQuery.value);
};

const handleOpenRecipe = (id: number) => {
  router.push(`/recipes/${id}`);
};

onMounted(async () => {
  try {
    if (!userStore.user?.family_group_id) {
      await userStore.fetchUser();
    }
    await refreshEntitlements();
    await recipeStore.fetchRecipes();
  } catch (error) {
    console.error('Error loading recipes:', error);
  }
});
</script>
