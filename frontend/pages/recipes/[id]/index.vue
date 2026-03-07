<template>
  <div class="max-w-4xl mx-auto px-4">
    <div class="flex items-center gap-2 my-4">
      <button class="btn btn-ghost btn-sm" @click="router.push('/recipes')">
        <fa icon="chevron-left" />
        {{ $t('Back') }}
      </button>
    </div>

    <div v-if="recipeStore.loading && !recipe" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="recipe" class="pb-8">
      <div class="flex justify-between items-start mb-4">
        <h1 class="text-2xl font-bold">{{ recipe.name }}</h1>
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" @click="handleEdit">
            <fa icon="pencil" class="mr-1" />
            {{ $t('Edit Recipe') }}
          </button>
          <button class="btn btn-error btn-outline btn-sm" @click="handleShowDeleteConfirm">
            <fa icon="trash" />
          </button>
        </div>
      </div>

      <p v-if="recipe.description" class="text-base-content/70 mb-4">{{ recipe.description }}</p>

      <div v-if="recipe.portions" class="badge badge-primary mb-4">
        {{ recipe.portions }} {{ $t('portions') }}
      </div>

      <!-- Ingredients -->
      <div v-if="recipe.ingredients?.length" class="mb-6">
        <h2 class="text-lg font-semibold mb-3">{{ $t('Ingredients') }}</h2>
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <ul class="space-y-2">
              <li v-for="ingredient in recipe.ingredients" :key="ingredient.id" class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-primary flex-shrink-0"></span>
                <span>{{ ingredient.name }}</span>
                <span v-if="ingredient.quantity || ingredient.unit" class="text-base-content/50 text-sm">
                  — {{ ingredient.quantity }}{{ ingredient.unit ? ` ${ingredient.unit}` : '' }}
                </span>
              </li>
            </ul>
          </div>
        </div>
        <button class="btn btn-outline btn-primary btn-sm mt-3" @click="handleAddToShoppingList">
          <fa icon="list" class="mr-1" />
          {{ $t('Add to Shopping List') }}
        </button>
      </div>

      <!-- Instructions -->
      <div v-if="recipe.instructions" class="mb-6">
        <h2 class="text-lg font-semibold mb-3">{{ $t('Instructions') }}</h2>
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <p class="whitespace-pre-wrap">{{ recipe.instructions }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <dialog id="delete_recipe_modal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">{{ $t('Delete Recipe') }}</h3>
        <p class="py-4">{{ $t('Are you sure you want to delete this recipe? It will also be removed from any meal diary entries.') }}</p>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-ghost mr-2">{{ $t('Cancel') }}</button>
          </form>
          <button class="btn btn-error" @click="handleDelete" :disabled="recipeStore.loading">
            <span v-if="recipeStore.loading" class="loading loading-spinner loading-sm"></span>
            <span v-else>{{ $t('Delete') }}</span>
          </button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth'
});

import { useRecipeStore } from '~/stores/recipe';
import { useUserStore } from '~/stores/user';
import { useApi } from '~/composables/useApi';
import { useToast } from '~/composables/useToast';

const route = useRoute();
const router = useRouter();
const recipeStore = useRecipeStore();
const userStore = useUserStore();
const { showError } = useToast();

const recipe = computed(() => recipeStore.currentRecipe);

const handleEdit = () => {
  router.push(`/recipes/${route.params.id}/edit`);
};

const handleShowDeleteConfirm = () => {
  const modal = document.getElementById('delete_recipe_modal');
  if (modal) modal.showModal();
};

const handleDelete = async () => {
  try {
    await recipeStore.deleteRecipe(parseInt(route.params.id));
    const modal = document.getElementById('delete_recipe_modal');
    if (modal) modal.close();
    router.push('/recipes');
  } catch (error) {
    console.error('Error deleting recipe:', error);
  }
};

const handleAddToShoppingList = async () => {
  if (!recipe.value?.ingredients?.length || !userStore.user?.family_group_id) return;

  try {
    const { api } = useApi();
    const familyGroupId = userStore.user.family_group_id;

    const items = recipe.value.ingredients.map((ingredient) => {
      const itemName = ingredient.quantity && ingredient.unit
        ? `${ingredient.name} (${ingredient.quantity} ${ingredient.unit})`
        : ingredient.quantity
          ? `${ingredient.name} (${ingredient.quantity})`
          : ingredient.name;

      return {
        name: itemName,
        parent_item_id: null
      };
    });

    await api(`/api/shopping-list/${familyGroupId}/items/bulk`, {
      method: 'POST',
      body: {
        items
      }
    });

    const { showSuccess } = useToast();
    showSuccess('Ingredients added to shopping list!');
  } catch (error) {
    console.error('Error adding ingredients to shopping list:', error);
  }
};

onMounted(async () => {
  if (!userStore.user?.family_group_id) {
    await userStore.fetchUser();
  }
  await recipeStore.fetchRecipeById(parseInt(route.params.id));
});
</script>
