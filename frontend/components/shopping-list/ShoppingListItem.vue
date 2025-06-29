<template>
  <div class="flex items-center justify-between list-none">
    <div class="flex-1 flex items-center">
      <input 
        type="checkbox"
        class="checkbox checkbox-primary mr-2"
        :checked="item.checked"
        @change="handleCheckboxChange"
      />
      <div 
        v-if="!isEditing" 
        class="flex-1 px-3 py-2 cursor-pointer"
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
        :class="{ 'line-through text-gray-400': item.checked }"
        :value="item.name"
        @change="handleNameChange($event.target.value)"
        @blur="stopEditing"
        @keyup.enter="stopEditing"
        @keyup.escape="cancelEditing"
        @focus="scrollToInput($event.target)"
        ref="editInput"
      />
    </div>
    <button 
      class="btn btn-ghost btn-sm"
      @click="handleRemove"
    >
      <fa icon="xmark" />
    </button>
  </div>
</template>

<script setup>
const emit = defineEmits(['update', 'remove']);

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

const handleRemove = () => {
  emit('remove', props.item.id);
};
</script>
