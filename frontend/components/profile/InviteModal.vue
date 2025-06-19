<template>
  <div>
    <dialog ref="modal" class="modal">
      <div class="modal-box">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        <h3 class="font-bold text-lg mb-4">{{ $t('Invite Family Member') }}</h3>
        
        <div class="space-y-4">
          <p class="text-base-content/80">
            {{ $t('Share this invite link with your family members to join your family group') }}
          </p>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">{{ $t('Invite Link') }}</span>
            </label>
            <div class="flex gap-2">
              <input 
                type="text" 
                :value="inviteLink" 
                readonly
                class="input input-bordered flex-1 font-mono text-sm"
              />
              <button 
                class="btn btn-outline" 
                @click="handleCopyLink"
                :disabled="isCopying"
              >
                <span v-if="isCopying" class="loading loading-spinner loading-sm"></span>
                <fa v-else icon="copy" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>{{ $t('Close') }}</button>
      </form>
    </dialog>

    <!-- Toast notifications -->
    <div v-if="showToast" class="toast toast-top toast-end">
      <div :class="toastClass">
        <span>{{ toastMessage }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
// @ts-ignore
import { useRuntimeConfig } from '#imports';
import { Clipboard } from '@capacitor/clipboard';

const config = useRuntimeConfig();
const origin = config.public.origin || 'https://meal-diary.co.uk'

const modal = ref<HTMLDialogElement | null>(null);
const isCopying = ref(false);
const showToast = ref(false);
const toastMessage = ref('');
const toastClass = ref('');

const props = defineProps<{
  familyGroupCode: string;
}>();

const inviteLink = computed(() => {
  return `${origin}/registration/step-1?code=${props.familyGroupCode}`;
});

const showToastNotification = (message: string, isSuccess: boolean = true) => {
  toastMessage.value = message;
  toastClass.value = isSuccess ? 'alert alert-success' : 'alert alert-error';
  showToast.value = true;
  
  setTimeout(() => {
    showToast.value = false;
  }, 3000);
};

const handleCopyLink = async () => {
  if (isCopying.value) return;
  
  isCopying.value = true;
  
  try {
    await Clipboard.write({
      string: inviteLink.value
    });
    showToastNotification('Invite link copied to clipboard!', true);
  } catch (err) {
    console.error('Failed to copy:', err);
    showToastNotification('Failed to copy invite link', false);
  } finally {
    isCopying.value = false;
  }
};

const showModal = () => {
  modal.value?.showModal();
};

const closeModal = () => {
  modal.value?.close();
};

defineExpose({
  showModal,
  closeModal
});
</script> 