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

    <div v-else class="space-y-4">
      <button
        v-if="creationMode"
        class="btn btn-outline btn-sm"
        @click="handleOpenCreationOptions"
      >
        {{ $t('recipeImport.changeMethod') }}
      </button>

      <div v-if="creationMode === 'import'" class="card bg-base-200 border border-base-300">
        <div class="card-body gap-4">
          <div>
            <h2 class="card-title">{{ $t('recipeImport.title') }}</h2>
            <p class="text-sm text-base-content/70">{{ $t('recipeImport.description') }}</p>
          </div>

          <label class="form-control">
            <span class="label">
              <span class="label-text font-semibold">{{ $t('recipeImport.urlLabel') }}</span>
            </span>
            <input
              v-model="importUrl"
              type="url"
              class="input input-bordered w-full"
              data-testid="recipe-import-url-input"
              :placeholder="$t('recipeImport.urlPlaceholder')"
              :disabled="isImporting"
            />
          </label>

          <div v-if="importError" class="alert alert-error" data-testid="recipe-import-error">
            <span>{{ importError }}</span>
          </div>

          <div
            v-if="isImporting"
            class="alert alert-info items-start"
            data-testid="recipe-import-loading"
          >
            <span class="loading loading-spinner loading-sm mt-0.5"></span>
            <div>
              <div class="font-medium">{{ $t('recipeImport.loadingTitle') }}</div>
              <div class="text-sm">{{ importProgressMessage }}</div>
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <button class="btn btn-ghost" :disabled="isImporting" @click="router.push('/recipes')">
              {{ $t('Cancel') }}
            </button>
            <button
              class="btn btn-primary"
              data-testid="recipe-import-submit-button"
              :disabled="!canSubmitImport || isImporting"
              @click="handleImportRecipe"
            >
              <span v-if="isImporting" class="loading loading-spinner loading-sm"></span>
              <span>{{ $t('recipeImport.submit') }}</span>
            </button>
          </div>
        </div>
      </div>

      <RecipeForm
        v-else-if="creationMode === 'manual'"
        :submitLabel="$t('Create Recipe')"
        :isLoading="recipeStore.loading"
        @submit="handleCreate"
        @cancel="router.push('/recipes')"
      />
    </div>

    <dialog
      ref="creationOptionsDialog"
      class="modal"
      data-testid="recipe-create-method-dialog"
      @close="handleDismissCreationOptions"
    >
      <div class="modal-box space-y-4">
        <h2 class="text-xl font-semibold">{{ $t('recipeImport.chooseMethodTitle') }}</h2>
        <p class="text-sm text-base-content/70">{{ $t('recipeImport.chooseMethodDescription') }}</p>

        <div class="grid gap-3">
          <button
            class="btn btn-outline justify-start h-auto py-4"
            data-testid="recipe-create-method-manual"
            @click="handleSelectCreationMode('manual')"
          >
            <div class="text-left">
              <div class="font-semibold">{{ $t('recipeImport.manualOptionTitle') }}</div>
              <div class="text-xs text-base-content/70">{{ $t('recipeImport.manualOptionDescription') }}</div>
            </div>
          </button>
          <button
            class="btn btn-outline justify-start h-auto py-4"
            data-testid="recipe-create-method-import"
            @click="handleSelectCreationMode('import')"
          >
            <div class="text-left">
              <div class="font-semibold">{{ $t('recipeImport.importOptionTitle') }}</div>
              <div class="text-xs text-base-content/70">{{ $t('recipeImport.importOptionDescription') }}</div>
            </div>
          </button>
        </div>

        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-ghost" @click="handleDismissCreationOptions">
              {{ $t('Cancel') }}
            </button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="handleDismissCreationOptions">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
});

import { useRecipeStore } from '~/stores/recipe';
import { useUserStore } from '~/stores/user';
import RecipeForm from '~/components/recipe/RecipeForm.vue';
import { extractEntitlementError, extractErrorMessage } from '~/utils/httpError';

const router = useRouter();
const recipeStore = useRecipeStore();
const userStore = useUserStore();
const { t } = useI18n();
const { track } = useAnalytics();
const { hasFeature, refreshEntitlements } = useEntitlements();
const { openPaywall } = usePaywall();

const canCreateRecipe = hasFeature('recipes');
const creationMode = ref<'manual' | 'import' | null>(null);
const creationOptionsDialog = ref<HTMLDialogElement | null>(null);
const importUrl = ref('');
const importError = ref('');
const isImporting = ref(false);
const importProgressStep = ref(0);
let importProgressTimeouts: ReturnType<typeof setTimeout>[] = [];

const importProgressKeys = [
  'recipeImport.progress.validating',
  'recipeImport.progress.fetching',
  'recipeImport.progress.creating',
] as const;

const importProgressMessage = computed(() => t(importProgressKeys[importProgressStep.value]));
const canSubmitImport = computed(() => importUrl.value.trim().length > 0);

const clearImportProgress = () => {
  importProgressTimeouts.forEach(clearTimeout);
  importProgressTimeouts = [];
};

const startImportProgress = () => {
  clearImportProgress();
  importProgressStep.value = 0;
  importProgressTimeouts = [
    setTimeout(() => {
      importProgressStep.value = 1;
    }, 900),
    setTimeout(() => {
      importProgressStep.value = 2;
    }, 1800),
  ];
};

const handleOpenCreationOptions = async () => {
  await nextTick();
  creationOptionsDialog.value?.showModal();
};

const handleSelectCreationMode = (mode: 'manual' | 'import') => {
  creationMode.value = mode;
  importError.value = '';
  creationOptionsDialog.value?.close();
};

const handleDismissCreationOptions = () => {
  if (!creationMode.value) {
    router.push('/recipes');
  }
};

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

const handleImportRecipe = async () => {
  if (!canCreateRecipe.value || !canSubmitImport.value) {
    return;
  }

  importError.value = '';
  isImporting.value = true;
  startImportProgress();

  try {
    const recipe = await recipeStore.importRecipeFromUrl({ url: importUrl.value.trim() });
    if (recipe) {
      track('recipe_imported');
      router.push(`/recipes/${recipe.id}/edit`);
    }
  } catch (error) {
    const entitlementError = extractEntitlementError(error);
    if (entitlementError?.feature === 'recipes') {
      openPaywall('recipes');
      return;
    }

    importError.value = extractErrorMessage(error) || t('recipeImport.genericError');
    console.error('Error importing recipe:', error);
  } finally {
    isImporting.value = false;
    clearImportProgress();
  }
};

onMounted(async () => {
  if (!userStore.user?.family_group_id) {
    await userStore.fetchUser();
  }

  await refreshEntitlements();
  await handleOpenCreationOptions();
});

onBeforeUnmount(() => {
  clearImportProgress();
});
</script>
