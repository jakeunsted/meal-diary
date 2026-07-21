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
          <button class="btn btn-outline btn-sm" data-testid="recipe-edit-button" @click="handleEdit">
            <fa icon="pencil" class="mr-1" />
            {{ $t('Edit Recipe') }}
          </button>
          <button class="btn btn-error btn-outline btn-sm" data-testid="recipe-delete-button" @click="handleShowDeleteConfirm">
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
        <button
          class="btn btn-outline btn-primary btn-sm mt-3"
          data-testid="recipe-add-to-shopping-list-button"
          :disabled="!canAddToShoppingList"
          @click="handleOpenAddToShoppingListModal"
        >
          <fa icon="list" class="mr-1" />
          {{ $t('Add to Shopping List') }}
        </button>
        <p v-if="!canAddToShoppingList" class="text-sm text-base-content/60 mt-2" data-testid="recipe-shopping-list-premium-hint">
          {{ $t('recipeDetail.shoppingListPremium') }}
          <NuxtLink v-if="billing.isOwner" class="link link-primary ml-1" to="/plans">
            {{ $t('recipeDetail.shoppingListUpgrade') }}
          </NuxtLink>
        </p>
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

    <!-- Add to shopping list modal -->
    <RecipeAddToShoppingListModal
      ref="addToShoppingListModalRef"
      :ingredients="recipe?.ingredients ?? []"
      :is-submitting="isAddingToShoppingList"
      @confirm="handleConfirmAddToShoppingList"
    />

    <!-- Delete confirmation modal -->
    <dialog id="delete_recipe_modal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">{{ $t('Delete Recipe') }}</h3>
        <p class="py-4">{{ $t('Are you sure you want to delete this recipe? It will also be removed from any meal diary entries.') }}</p>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-ghost mr-2">{{ $t('Cancel') }}</button>
          </form>
          <button class="btn btn-error" data-testid="recipe-confirm-delete-button" @click="handleDelete" :disabled="recipeStore.loading">
            <span v-if="recipeStore.loading" class="loading loading-spinner loading-sm"></span>
            <span v-else>{{ $t('Delete') }}</span>
          </button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
});

import { useRecipeStore } from '~/stores/recipe';
import { useUserStore } from '~/stores/user';
import { useApi } from '~/composables/useApi';
import { useToast } from '~/composables/useToast';
import { extractEntitlementError } from '~/utils/httpError';
import { buildShoppingListItemsFromRecipe } from '~/utils/buildShoppingListItemsFromRecipe';
import type { RecipeIngredient } from '~/types/Recipe';

const route = useRoute();
const router = useRouter();
const recipeStore = useRecipeStore();
const userStore = useUserStore();
const { showError } = useToast();
const { track } = useAnalytics();
const { hasFeature, billing, refreshEntitlements } = useEntitlements();
const { openPaywall } = usePaywall();
const { t } = useI18n();

const addToShoppingListModalRef = ref<{ showModal: () => void; closeModal: () => void } | null>(null);
const isAddingToShoppingList = ref(false);

const recipe = computed(() => recipeStore.currentRecipe);
const canAddToShoppingList = hasFeature('recipe_to_shopping_list');

const getIngredientKey = (ingredient: RecipeIngredient, index: number): string => {
  return ingredient.id != null ? String(ingredient.id) : `index-${index}`;
};

const filterIngredientsBySelectedKeys = (
  ingredients: RecipeIngredient[],
  selectedKeys: string[]
): RecipeIngredient[] => {
  const selectedKeySet = new Set(selectedKeys);
  return ingredients.filter((ingredient, index) =>
    selectedKeySet.has(getIngredientKey(ingredient, index))
  );
};

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
    track('recipe_deleted');
    const modal = document.getElementById('delete_recipe_modal');
    if (modal) modal.close();
    router.push('/recipes');
  } catch (error) {
    console.error('Error deleting recipe:', error);
  }
};

const handleOpenAddToShoppingListModal = () => {
  if (!canAddToShoppingList.value) {
    openPaywall('recipe_to_shopping_list');
    return;
  }

  if (!recipe.value?.ingredients?.length || !userStore.user?.family_group_id) return;

  addToShoppingListModalRef.value?.showModal();
};

const handleConfirmAddToShoppingList = async (selectedKeys: string[]) => {
  if (!recipe.value?.ingredients?.length || !userStore.user?.family_group_id) return;

  const selectedIngredients = filterIngredientsBySelectedKeys(recipe.value.ingredients, selectedKeys);
  if (!selectedIngredients.length) return;

  isAddingToShoppingList.value = true;

  try {
    const { api } = useApi();
    const familyGroupId = userStore.user.family_group_id;
    const items = buildShoppingListItemsFromRecipe(selectedIngredients);

    await api(`/api/shopping-list/${familyGroupId}/items/bulk`, {
      method: 'POST',
      silent: true,
      body: {
        items
      }
    });

    track('recipe_added_to_shopping_list', { item_count: items.length });
    addToShoppingListModalRef.value?.closeModal();
    const { showSuccess } = useToast();
    showSuccess('Ingredients added to shopping list!');
  } catch (error) {
    const entitlementError = extractEntitlementError(error);
    if (entitlementError?.feature === 'recipe_to_shopping_list') {
      openPaywall('recipe_to_shopping_list');
      return;
    }

    console.error('Error adding ingredients to shopping list:', error);
    showError(t('recipeDetail.addToShoppingListFailed'));
  } finally {
    isAddingToShoppingList.value = false;
  }
};

onMounted(async () => {
  if (!userStore.user?.family_group_id) {
    await userStore.fetchUser();
  }
  await refreshEntitlements();
  await recipeStore.fetchRecipeById(parseInt(route.params.id));
  track('recipe_viewed');
});
</script>
