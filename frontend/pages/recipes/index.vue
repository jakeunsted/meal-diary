<template>
  <div class="max-w-4xl mx-auto px-4">
    <h1 class="text-2xl font-bold text-center m-4">{{ $t('Recipe Book') }}</h1>

    <div class="flex gap-2 mb-4">
      <div class="relative flex-1">
        <fa icon="magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
        <input
          type="text"
          class="input input-bordered w-full pl-10"
          :placeholder="$t('Search recipes...')"
          v-model="searchQuery"
          @input="handleSearch"
        />
      </div>
      <button class="btn btn-primary" @click="navigateTo('/recipes/create')">
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
      <button class="btn btn-primary" @click="navigateTo('/recipes/create')">
        <fa icon="plus" class="mr-1" />
        {{ $t('New Recipe') }}
      </button>
    </div>

    <div v-else-if="recipes.length === 0" class="text-center py-12">
      <p class="text-lg font-medium">{{ $t('No recipes found') }}</p>
      <p class="text-base-content/60">{{ $t('Try a different search term') }}</p>
    </div>

    <div v-else class="grid gap-3">
      <RecipeCard
        v-for="recipe in recipes"
        :key="recipe.id"
        :recipe="recipe"
        @click="navigateTo(`/recipes/${recipe.id}`)"
      />
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth'
});

import { useRecipeStore } from '~/stores/recipe';
import { useUserStore } from '~/stores/user';
import RecipeCard from '~/components/recipe/RecipeCard.vue';

const recipeStore = useRecipeStore();
const userStore = useUserStore();
const router = useRouter();

const searchQuery = ref('');

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

const navigateTo = (path) => {
  router.push(path);
};

onMounted(async () => {
  if (!userStore.user?.family_group_id) {
    await userStore.fetchUser();
  }
  await recipeStore.fetchRecipes();
});
</script>
