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
      :placeholder="$t('Meal Name')"
    />
    <div class="flex flex-col items-center">
      <button class="btn btn-outline btn-primary btn-sm" @click="saveMeal">{{ $t('Save') }}</button>
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

const saveMeal = () => {
  emit('saveMeal', props.meal);
}
</script>