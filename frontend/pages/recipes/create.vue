<template>
  <div class="max-w-4xl mx-auto px-4">
    <div class="flex items-center gap-2 my-4">
      <button class="btn btn-ghost btn-sm" @click="router.push('/recipes')">
        <fa icon="chevron-left" />
        {{ $t('Back') }}
      </button>
    </div>

    <h1 class="text-2xl font-bold mb-4">{{ $t('New Recipe') }}</h1>

    <RecipeForm
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

const router = useRouter();
const recipeStore = useRecipeStore();
const userStore = useUserStore();

const handleCreate = async (formData) => {
  try {
    const recipe = await recipeStore.createRecipe(formData);
    if (recipe) {
      router.push(`/recipes/${recipe.id}`);
    }
  } catch (error) {
    console.error('Error creating recipe:', error);
  }
};

onMounted(async () => {
  if (!userStore.user?.family_group_id) {
    await userStore.fetchUser();
  }
});
</script>
