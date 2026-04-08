<template>
  <div class="max-w-4xl mx-auto px-4">
    <div class="flex items-center gap-2 my-4">
      <button class="btn btn-ghost btn-sm" @click="router.push(`/recipes/${route.params.id}`)">
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
      @cancel="router.push(`/recipes/${route.params.id}`)"
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

const route = useRoute();
const router = useRouter();
const recipeStore = useRecipeStore();
const userStore = useUserStore();

const recipe = computed(() => recipeStore.currentRecipe);

const handleUpdate = async (formData) => {
  try {
    await recipeStore.updateRecipe(parseInt(route.params.id), formData);
    router.push(`/recipes/${route.params.id}`);
  } catch (error) {
    console.error('Error updating recipe:', error);
  }
};

onMounted(async () => {
  if (!userStore.user?.family_group_id) {
    await userStore.fetchUser();
  }
  await recipeStore.fetchRecipeById(parseInt(route.params.id));
});
</script>
