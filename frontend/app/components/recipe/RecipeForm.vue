<template>
  <div class="max-w-4xl mx-auto">
    <div class="space-y-4">
      <!-- Name -->
      <div class="form-control">
        <label class="label">
          <span class="label-text font-semibold">{{ $t('Recipe Name') }} *</span>
        </label>
        <input
          type="text"
          class="input input-bordered w-full"
          data-testid="recipe-form-name-input"
          :placeholder="$t('Recipe Name')"
          v-model="form.name"
          required
        />
      </div>

      <!-- Description -->
      <div class="form-control">
        <label class="label">
          <span class="label-text font-semibold">{{ $t('Description') }}</span>
        </label>
        <textarea
          class="textarea textarea-bordered w-full"
          data-testid="recipe-form-description-input"
          :placeholder="$t('Description')"
          v-model="form.description"
          rows="2"
        ></textarea>
      </div>

      <!-- Portions -->
      <div class="form-control">
        <label class="label">
          <span class="label-text font-semibold">{{ $t('Portions') }}</span>
        </label>
        <input
          type="number"
          class="input input-bordered w-24"
          data-testid="recipe-form-portions-input"
          :placeholder="$t('Portions')"
          v-model.number="form.portions"
          min="1"
        />
      </div>

      <!-- Ingredients -->
      <div class="form-control">
        <label class="label">
          <span class="label-text font-semibold">{{ $t('Ingredients') }}</span>
        </label>
        <div class="space-y-2">
          <div
            v-for="(ingredient, index) in form.ingredients"
            :key="index"
            class="flex gap-2 items-center"
          >
            <input
              type="text"
              class="input input-bordered input-sm flex-1"
              :data-testid="`recipe-form-ingredient-name-${index}`"
              :placeholder="$t('Ingredient name')"
              v-model="ingredient.name"
            />
            <input
              type="number"
              class="input input-bordered input-sm w-20"
              :data-testid="`recipe-form-ingredient-quantity-${index}`"
              :placeholder="$t('Qty')"
              v-model.number="ingredient.quantity"
              step="0.1"
              min="0"
            />
            <input
              type="text"
              class="input input-bordered input-sm w-20"
              :data-testid="`recipe-form-ingredient-unit-${index}`"
              :placeholder="$t('Unit')"
              v-model="ingredient.unit"
            />
            <button
              class="btn btn-ghost btn-sm btn-circle text-error"
              :data-testid="`recipe-form-remove-ingredient-${index}`"
              @click="handleRemoveIngredient(index)"
            >
              <fa icon="circle-minus" />
            </button>
          </div>
        </div>
        <button
          class="btn btn-ghost btn-sm mt-2 self-start"
          data-testid="recipe-form-add-ingredient-button"
          @click="handleAddIngredient"
        >
          <fa icon="circle-plus" class="mr-1" />
          {{ $t('Add Ingredient') }}
        </button>
      </div>

      <!-- Instructions -->
      <div class="form-control">
        <label class="label">
          <span class="label-text font-semibold">{{ $t('Instructions') }}</span>
        </label>
        <textarea
          class="textarea textarea-bordered w-full"
          data-testid="recipe-form-instructions-input"
          :placeholder="$t('Instructions')"
          v-model="form.instructions"
          rows="6"
        ></textarea>
      </div>

      <!-- Submit -->
      <div class="flex justify-end gap-2 pt-2 pb-4">
        <button class="btn btn-ghost" data-testid="recipe-form-cancel-button" @click="$emit('cancel')">
          {{ $t('Cancel') }}
        </button>
        <button
          class="btn btn-primary"
          data-testid="recipe-form-submit-button"
          @click="handleSubmit"
          :disabled="!form.name || isLoading"
        >
          <span v-if="isLoading" class="loading loading-spinner loading-sm"></span>
          <span v-else>{{ submitLabel }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  initialData: {
    type: Object,
    default: null,
  },
  submitLabel: {
    type: String,
    default: 'Create Recipe',
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit', 'cancel']);

const form = reactive({
  name: props.initialData?.name || '',
  description: props.initialData?.description || '',
  instructions: props.initialData?.instructions || '',
  portions: props.initialData?.portions || null,
  ingredients: props.initialData?.ingredients?.map(i => ({ ...i })) || [],
});

// Watch for initialData changes (e.g. when editing a recipe loaded async)
watch(() => props.initialData, (newData) => {
  if (newData) {
    form.name = newData.name || '';
    form.description = newData.description || '';
    form.instructions = newData.instructions || '';
    form.portions = newData.portions || null;
    form.ingredients = newData.ingredients?.map(i => ({ ...i })) || [];
  }
}, { deep: true });

const handleAddIngredient = () => {
  form.ingredients.push({ name: '', quantity: null, unit: '' });
};

const handleRemoveIngredient = (index) => {
  form.ingredients.splice(index, 1);
};

const handleSubmit = () => {
  const cleanedIngredients = form.ingredients.filter(i => i.name.trim() !== '');
  emit('submit', {
    name: form.name,
    description: form.description || null,
    instructions: form.instructions || null,
    portions: form.portions || null,
    ingredients: cleanedIngredients,
  });
};
</script>
