<template>
  <div class="flex items-center justify-between">
    <div class="flex-1 flex items-center">
      <input 
        type="checkbox"
        class="checkbox checkbox-primary mr-2"
        :checked="item.checked"
        @change="handleCheckboxChange"
      />
      <input 
        type="text"
        :placeholder="$t('Enter item name')"
        class="input input-ghost flex-1"
        :class="{ 'line-through text-gray-400': item.checked }"
        :value="item.name"
        @change="handleNameChange($event.target.value)"
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

const handleCheckboxChange = () => {
  emit('update', {
    id: props.item.id,
    name: props.item.name,
    checked: props.item.checked
  });
};

const handleNameChange = (newName) => {
  emit('update', {
    id: props.item.id,
    name: newName
  });
};

const handleRemove = () => {
  emit('remove', props.item.id);
};
</script>
