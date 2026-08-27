<template>
  <div>
    <div class="flex items-center justify-between list-none px-2 py-1">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <button
          class="drag-handle btn btn-ghost btn-sm cursor-grab active:cursor-grabbing"
          type="button"
          data-sortable-handle
          :aria-label="$t('Reorder item')"
          style="touch-action: none;"
          data-testid="shopping-item-drag-handle"
        >
          <fa icon="grip-vertical" />
        </button>
        <input
          v-if="!hideCheckbox"
          type="checkbox"
          class="checkbox checkbox-primary mr-2"
          :data-testid="`shopping-item-checkbox-${item.id}`"
          :checked="item.checked"
          @change="handleCheckboxChange"
        />
        <div
          v-if="!isEditing"
          class="flex-1 px-3 py-2 cursor-pointer truncate"
          :data-testid="`shopping-item-name-${item.id}`"
          :class="{ 'line-through text-gray-400': item.checked }"
          @click="startEditing"
        >
          {{ item.name }}
        </div>
        <input
          v-else
          type="text"
          :placeholder="$t('Enter item name')"
          class="input input-ghost flex-1"
          :data-testid="`shopping-item-edit-input-${item.id}`"
          :class="{ 'line-through text-gray-400': item.checked }"
          :value="item.name"
          @change="handleNameChange($event.target.value)"
          @blur="stopEditing"
          @keyup.enter.prevent="handleEnterKey($event)"
          @keyup.escape="cancelEditing"
          @focus="scrollToInput($event.target)"
          ref="editInput"
        />
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button
          v-if="!item.checked"
          type="button"
          class="btn btn-ghost btn-sm"
          :data-testid="`shopping-item-move-${item.id}`"
          :aria-label="$t('Move to category')"
          @click="handleOpenCategoryModal"
        >
          <fa icon="folder" />
        </button>
        <button
          class="btn btn-ghost btn-sm"
          :data-testid="`shopping-item-remove-${item.id}`"
          type="button"
          @click="handleRemove"
          :aria-label="$t('Remove item')"
        >
          <fa icon="xmark" />
        </button>
      </div>
    </div>

    <dialog
      v-if="!item.checked"
      ref="categoryModal"
      class="modal"
      :data-testid="`shopping-item-move-modal-${item.id}`"
    >
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">{{ $t('Move to category') }}</h3>
        <ul class="menu bg-base-200 rounded-box w-full p-2">
          <li v-for="category in categories" :key="category">
            <button
              type="button"
              class="justify-between"
              :class="{ active: item.category === category }"
              :data-testid="`shopping-item-move-${item.id}-${category}`"
              @click="handleMoveToCategory(category)"
            >
              {{ categoryLabel(category) }}
            </button>
          </li>
        </ul>
        <div class="modal-action">
          <form method="dialog">
            <button type="submit" class="btn">{{ $t('Cancel') }}</button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">{{ $t('close') }}</button>
      </form>
    </dialog>
  </div>
</template>

<script setup>
import { SHOPPING_CATEGORIES } from '@meal-diary/shared';

const emit = defineEmits(['update', 'remove', 'insertBelow', 'moveCategory']);

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  hideCheckbox: {
    type: Boolean,
    default: false
  }
});

const { t } = useI18n();
const isEditing = ref(false);
const editInput = ref(null);
const categoryModal = ref(null);
const originalName = ref('');
const categories = SHOPPING_CATEGORIES;

const { scrollToInput } = useMobileInputScroll();

const categoryLabel = (category) => {
  switch (category) {
    case 'meat':
      return t('Meat');
    case 'fruit_veg':
      return t('Fruit & Veg');
    case 'bakery':
      return t('Bakery');
    case 'canned':
      return t('Canned');
    case 'other':
      return t('Other');
    default:
      return category;
  }
};

const startEditing = async () => {
  originalName.value = props.item.name;
  isEditing.value = true;
  await nextTick();
  editInput.value?.focus();
};

const stopEditing = () => {
  isEditing.value = false;
};

const cancelEditing = () => {
  if (editInput.value) {
    editInput.value.value = originalName.value;
  }
  isEditing.value = false;
};

const handleNameChange = (name) => {
  emit('update', { id: props.item.id, name });
};

const handleCheckboxChange = (event) => {
  emit('update', {
    id: props.item.id,
    name: props.item.name,
    checked: event.target.checked
  });
};

const handleRemove = () => {
  emit('remove', props.item.id);
};

const handleEnterKey = (event) => {
  event.target.blur();
  emit('insertBelow', props.item.id);
};

const handleOpenCategoryModal = () => {
  categoryModal.value?.showModal();
};

const handleCloseCategoryModal = () => {
  categoryModal.value?.close();
};

const handleMoveToCategory = (category) => {
  if (category === props.item.category) {
    handleCloseCategoryModal();
    return;
  }
  emit('moveCategory', { id: props.item.id, category });
  handleCloseCategoryModal();
};
</script>
