<template>
  <div class="modal-box">
    <form method="dialog">
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
    </form>
    <h3 class="font-bold">{{ $t('Set Meal') }}</h3>

    <!-- Recipe Selection -->
    <div v-if="recipes.length > 0" class="mb-4">
      <label class="label">
        <span class="label-text text-sm">{{ $t('Select Recipe') }}</span>
      </label>
      <select
        class="select select-bordered w-full"
        :value="selectedRecipeId || ''"
        @change="handleRecipeSelect($event.target.value)"
      >
        <option value="">— {{ $t('Or type a meal name') }} —</option>
        <option
          v-for="recipe in recipes"
          :key="recipe.id"
          :value="recipe.id"
        >
          {{ recipe.name }}
        </option>
      </select>
    </div>

    <!-- Divider when recipes exist -->
    <div v-if="recipes.length > 0 && !selectedRecipeId" class="divider text-xs text-base-content/50 my-2">
      {{ $t('Or type a meal name') }}
    </div>

    <!-- Text input for custom meal name -->
    <input
      v-if="!selectedRecipeId"
      type="text"
      class="input input-bordered w-full mb-4"
      required
      :value="meal"
      @input="handleMealInput($event.target.value)"
      @keydown.enter.prevent="saveMeal"
      :placeholder="$t('Meal Name')"
      :disabled="isLoading"
    />

    <!-- Show selected recipe info -->
    <div v-if="selectedRecipeId && selectedRecipeName" class="mb-4">
      <div class="badge badge-primary badge-lg">
        {{ selectedRecipeName }}
      </div>
    </div>

    <div class="flex flex-col items-center">
      <button
        class="btn btn-outline btn-primary btn-sm"
        @click="saveMeal"
        :disabled="isLoading || (!meal && !selectedRecipeId)"
      >
        <span v-if="isLoading" class="loading loading-spinner loading-sm"></span>
        <span v-else>{{ $t('Save') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useRecipeStore } from '~/stores/recipe';
import { useUserStore } from '~/stores/user';

const emit = defineEmits(['update:meal', 'update:recipeId', 'saveMeal']);

const props = defineProps({
  meal: {
    type: String,
    required: true,
  },
  recipeId: {
    type: [Number, null],
    default: null,
  },
  day: {
    type: Number,
    required: true,
  },
});

const recipeStore = useRecipeStore();
const userStore = useUserStore();
const isLoading = ref(false);

const selectedRecipeId = ref(props.recipeId);
const selectedRecipeName = ref('');

const recipes = computed(() => recipeStore.recipes);

// Load recipes on mount
onMounted(async () => {
  if (userStore.user?.family_group_id && recipeStore.recipes.length === 0) {
    await recipeStore.fetchRecipes();
  }
  // If there's an existing recipe_id, find its name
  if (props.recipeId) {
    const recipe = recipeStore.recipes.find(r => r.id === props.recipeId);
    if (recipe) {
      selectedRecipeName.value = recipe.name;
    }
  }
});

const handleRecipeSelect = (value) => {
  if (value) {
    const recipeId = parseInt(value);
    const recipe = recipeStore.recipes.find(r => r.id === recipeId);
    if (recipe) {
      selectedRecipeId.value = recipeId;
      selectedRecipeName.value = recipe.name;
      emit('update:meal', recipe.name);
      emit('update:recipeId', recipeId);
    }
  } else {
    selectedRecipeId.value = null;
    selectedRecipeName.value = '';
    emit('update:recipeId', null);
  }
};

const handleMealInput = (value) => {
  emit('update:meal', value);
  selectedRecipeId.value = null;
  selectedRecipeName.value = '';
  emit('update:recipeId', null);
};

const saveMeal = async () => {
  const closeButton = document.querySelector('.modal-box form button');
  if (closeButton) {
    closeButton.click();
  }
  emit('saveMeal', props.meal);
};
</script>
