<template>
  <div class="flex items-center gap-2 py-1">
    <button
      class="btn btn-outline btn-primary btn-sm rounded-lg w-[1.5rem]! h-[1.5rem]!"
      type="button"
      data-testid="shopping-list-new-item-button"
      @mousedown.prevent
      @click="handleSubmit"
    >
      <fa icon="plus" />
    </button>
    <input
      ref="inputRef"
      type="text"
      enterkeyhint="next"
      :placeholder="placeholder"
      class="input input-ghost w-full pr-5"
      data-testid="shopping-list-new-item-input"
      :value="modelValue"
      @input="handleInput"
      @keydown.enter.prevent="handleSubmit"
    />
  </div>
</template>

<script setup lang="ts">
const modelValue = defineModel<string>({ required: true });

defineProps<{
  placeholder: string;
}>();

const emit = defineEmits<{
  submit: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);

const handleInput = (event: Event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  modelValue.value = target.value;
};

const handleSubmit = () => {
  emit('submit');
  void nextTick(() => {
    inputRef.value?.focus({ preventScroll: true });
  });
};
</script>
