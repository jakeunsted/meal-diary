<template>
  <div class="modal-box">
    <form method="dialog">
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
    </form>
    <h3 class="font-bold">{{ $t('Set Meal') }}</h3>
    <input
      type="text"
      class="input input-bordered w-full mb-4"
      required
      :value="meal"
      @input="$emit('update:meal', $event.target.value)"
      @keydown.enter.prevent="saveMeal"
      :placeholder="$t('Meal Name')"
      :disabled="isLoading"
    />
    <div class="flex flex-col items-center">
      <button 
        class="btn btn-outline btn-primary btn-sm" 
        @click="saveMeal"
        :disabled="isLoading"
      >
        <span v-if="isLoading" class="loading loading-spinner loading-sm"></span>
        <span v-else>{{ $t('Save') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
const emit = defineEmits(['update:meal', 'saveMeal']);

const props = defineProps({
  meal: {
    type: String,
    required: true,
  },
  day: {
    type: Number,
    required: true,
  },
});

const isLoading = ref(false);

const saveMeal = async () => {
  // Close the modal immediately
  const closeButton = document.querySelector('.modal-box form button');
  if (closeButton) {
    closeButton.click();
  }
  
  // Emit the save event without waiting
  emit('saveMeal', props.meal);
}
</script>