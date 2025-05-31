<template>
  <dialog ref="dialog" class="modal">
    <form method="dialog" class="modal-backdrop">
      <button>{{ $t('Close') }}</button>
    </form>
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">x</button>
      </form>
      <h3 class="font-bold text-lg">{{ $t('Add Category') }}</h3>
      <div class="form-control w-full">
        <select 
          v-model="selectedCategory" 
          class="select select-bordered w-full"
          :class="{ 'select-error': hasError }"
        >
          <option :value="null">{{ $t('Select Category') }}</option>
          <option v-for="category in availableCategories" :key="category.id" :value="category">
            {{ category.name }}
          </option>
        </select>
        <label class="label" v-if="hasError">
          <span class="label-text-alt text-error">{{ $t('Please select a category') }}</span>
        </label>
      </div>
      
      <div class="modal-action">
        <button class="btn btn-primary" @click="handleSubmit">{{ $t('Add') }}</button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useShoppingListStore } from '../../stores/shoppingList';

interface ItemCategory {
  id: number;
  name: string;
  icon: string;
}

const props = defineProps<{
  itemCategories: ItemCategory[];
}>();

const shoppingListStore = useShoppingListStore();
const dialog = ref<HTMLDialogElement | null>(null);
const selectedCategory = ref<ItemCategory | null>(null);
const hasAttemptedSubmit = ref(false);
const hasError = computed(() => hasAttemptedSubmit.value && !selectedCategory.value);

// Filter out categories that are already in the shopping list
const availableCategories = computed(() => {
  const existingCategoryIds = shoppingListStore.shoppingList?.categories.map(c => c.item_categories_id) || [];
  return props.itemCategories.filter(category => !existingCategoryIds.includes(category.id));
});

const emit = defineEmits<{
  (e: 'addCategory', category: ItemCategory): void;
}>();

const handleSubmit = () => {
  hasAttemptedSubmit.value = true;
  if (!selectedCategory.value) return;
  
  emit('addCategory', selectedCategory.value);
  selectedCategory.value = null;
  hasAttemptedSubmit.value = false;
};

const showModal = () => {
  dialog.value?.showModal();
  hasAttemptedSubmit.value = false;
};

defineExpose({
  showModal
});
</script>