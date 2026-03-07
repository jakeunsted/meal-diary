<template>
  <div
    class="flex items-center justify-between list-none px-2 py-1"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
  >
    <div class="flex items-center gap-2 flex-1">
      <button
        class="drag-handle btn btn-ghost btn-sm cursor-grab active:cursor-grabbing"
        type="button"
        :aria-label="$t('Reorder item')"
        style="touch-action: none;"
      >
        <fa icon="grip-vertical" />
      </button>
      <input 
        type="checkbox"
        class="checkbox checkbox-primary mr-2"
        :data-testid="`shopping-item-checkbox-${item.id}`"
        :checked="item.checked"
        @change="handleCheckboxChange"
      />
      <div 
        v-if="!isEditing" 
        class="flex-1 px-3 py-2 cursor-pointer"
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
    <div class="flex items-center gap-1">
      <button
        class="btn btn-ghost btn-xs"
        type="button"
        :data-testid="`shopping-item-outdent-${item.id}`"
        @click="handleOutdent"
        :aria-label="$t('Outdent item')"
      >
        <fa icon="angle-left" />
      </button>
      <button
        class="btn btn-ghost btn-xs"
        type="button"
        :data-testid="`shopping-item-indent-${item.id}`"
        @click="handleIndent"
        :aria-label="$t('Indent item')"
      >
        <fa icon="angle-right" />
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
</template>

<script setup>
const emit = defineEmits(['update', 'remove', 'indent', 'outdent', 'insertBelow']);

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
});

const isEditing = ref(false);
const editInput = ref(null);
const originalName = ref('');

// Add mobile input scroll functionality
const { scrollToInput } = useMobileInputScroll();

let touchStartX = 0;
let touchStartY = 0;
const SWIPE_THRESHOLD = 40;

const startEditing = () => {
  isEditing.value = true;
  originalName.value = props.item.name;
  nextTick(() => {
    editInput.value?.focus();
    editInput.value?.select();
    // Scroll to the input when editing starts
    scrollToInput(editInput.value);
  });
};

const stopEditing = () => {
  isEditing.value = false;
};

const cancelEditing = () => {
  if (originalName.value !== props.item.name) {
    emit('update', {
      id: props.item.id,
      name: originalName.value
    });
  }
  stopEditing();
};

const handleCheckboxChange = (event) => {
  emit('update', {
    id: props.item.id,
    name: props.item.name,
    checked: event.target.checked
  });
};

const handleNameChange = (newName) => {
  emit('update', {
    id: props.item.id,
    name: newName
  });
  // Exit editing mode after update
  stopEditing();
};

const handleEnterKey = (event) => {
  const newName = event?.target?.value ?? '';
  emit('update', {
    id: props.item.id,
    name: newName
  });
  emit('insertBelow', props.item.id);
  stopEditing();
};

const handleRemove = () => {
  emit('remove', props.item.id);
};

const handleIndent = () => {
  emit('indent', props.item.id);
};

const handleOutdent = () => {
  emit('outdent', props.item.id);
};

const handleTouchStart = (event) => {
  if (!event.touches || event.touches.length === 0) {
    return;
  }
  const touch = event.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
};

const handleTouchEnd = (event) => {
  if (!event.changedTouches || event.changedTouches.length === 0) {
    return;
  }
  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = Math.abs(touch.clientY - touchStartY);

  if (deltaY >= SWIPE_THRESHOLD) {
    return;
  }
  if (deltaX > SWIPE_THRESHOLD) {
    handleIndent();
  } else if (deltaX < -SWIPE_THRESHOLD) {
    handleOutdent();
  }
};
</script>
