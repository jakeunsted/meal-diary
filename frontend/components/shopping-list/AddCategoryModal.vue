<template>
  <dialog id="add_category_modal" class="modal">
    <form method="dialog" class="modal-backdrop">
      <button>{{ $t('close') }}</button>
    </form>
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
      </form>
      <h3 class="text-lg font-bold mb-2">{{ $t('Add Category') }}</h3>
      <input
        type="text"
        class="input input-bordered w-full mb-4"
        required
        :value="newCategoryName"
        @input="$emit('update:newCategoryName', $event.target.value)"
        :placeholder="$t('Category Name')"
      />
      <div class="flex flex-col items-center">
        <button class="btn btn-outline btn-primary btn-sm" @click="saveNewCategory">{{ $t('Save') }}</button>
      </div>
    </div>
  </dialog>
</template>

<script setup>
const emit = defineEmits(['update:newCategoryName', 'saveNewCategory']);
const props = defineProps({
  newCategoryName: String,
  saveNewCategory: Function,
});
</script>
