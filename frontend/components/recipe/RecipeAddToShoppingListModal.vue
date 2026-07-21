<template>
  <dialog ref="modal" class="modal" data-testid="recipe-add-to-shopping-list-modal">
    <div class="modal-box max-h-[80vh] flex flex-col">
      <h3 class="font-bold text-lg mb-4">{{ $t('recipeDetail.addToShoppingListModalTitle') }}</h3>

      <div class="overflow-y-auto flex-1 min-h-0 -mx-2 px-2">
        <ul class="space-y-2">
          <li
            v-for="(ingredient, index) in ingredients"
            :key="getIngredientKey(ingredient, index)"
          >
            <label
              class="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-2 hover:bg-base-200"
              :data-testid="`recipe-shopping-list-ingredient-${getIngredientKey(ingredient, index)}`"
            >
              <input
                v-model="selectedByKey[getIngredientKey(ingredient, index)]"
                type="checkbox"
                class="checkbox checkbox-primary"
              />
              <span class="flex-1">
                {{ ingredient.name }}
                <span
                  v-if="ingredient.quantity || ingredient.unit"
                  class="text-base-content/50 text-sm"
                >
                  — {{ ingredient.quantity }}{{ ingredient.unit ? ` ${ingredient.unit}` : '' }}
                </span>
              </span>
            </label>
          </li>
        </ul>
      </div>

      <div class="modal-action mt-4 shrink-0">
        <button class="btn btn-ghost mr-2" type="button" @click="handleClose">
          {{ $t('Cancel') }}
        </button>
        <button
          class="btn btn-primary"
          type="button"
          data-testid="recipe-add-to-list-confirm-button"
          :disabled="!hasSelection || isSubmitting"
          @click="handleConfirm"
        >
          <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
          <span v-else>{{ $t('recipeDetail.addToList') }}</span>
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="handleClose">
      <button type="button">{{ $t('Close') }}</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import type { RecipeIngredient } from '~/types/Recipe';

const props = defineProps<{
  ingredients: RecipeIngredient[];
  isSubmitting?: boolean;
}>();

const emit = defineEmits<{
  confirm: [selectedKeys: string[]];
  close: [];
}>();

const modal = ref<HTMLDialogElement | null>(null);
const selectedByKey = ref<Record<string, boolean>>({});

const getIngredientKey = (ingredient: RecipeIngredient, index: number): string => {
  return ingredient.id != null ? String(ingredient.id) : `index-${index}`;
};

const resetSelection = () => {
  const next: Record<string, boolean> = {};
  props.ingredients.forEach((ingredient, index) => {
    next[getIngredientKey(ingredient, index)] = false;
  });
  selectedByKey.value = next;
};

const hasSelection = computed(() =>
  Object.values(selectedByKey.value).some((selected) => selected)
);

const handleConfirm = () => {
  const selectedKeys = Object.entries(selectedByKey.value)
    .filter(([, selected]) => selected)
    .map(([key]) => key);
  emit('confirm', selectedKeys);
};

const handleClose = () => {
  closeModal();
  emit('close');
};

const showModal = () => {
  resetSelection();
  modal.value?.showModal();
};

const closeModal = () => {
  modal.value?.close();
};

defineExpose({
  showModal,
  closeModal,
});
</script>
