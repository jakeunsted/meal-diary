<template>
  <dialog ref="modal" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">{{ $t('Category Options') }}</h3>
      <div class="flex flex-col gap-2">
        <button class="btn btn-dash btn-primary" @click="handleUntickAll">
          {{ $t('Untick All') }}
        </button>
        <button class="btn btn-dash btn-primary" @click="handleTickAll">
          {{ $t('Tick All') }}
        </button>
        <button class="btn btn-error" @click="handleDeleteGroup">
          {{ $t('Delete Group') }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup>
const modal = ref(null);

const props = defineProps({
  categoryName: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['untickAll', 'tickAll', 'deleteGroup']);

const handleUntickAll = () => {
  emit('untickAll');
  modal.value?.close();
};

const handleTickAll = () => {
  emit('tickAll');
  modal.value?.close();
};

const handleDeleteGroup = () => {
  emit('deleteGroup');
  modal.value?.close();
};

defineExpose({
  showModal: () => modal.value?.showModal()
});
</script> 