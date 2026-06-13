<template>
  <div v-if="familyGroup" class="card bg-base-200 h-full">
    <div class="card-body">
      <h2 class="card-title">{{ $t('Family settings') }}</h2>
      <p class="text-sm opacity-70">
        {{ isOwner
          ? $t('You are the owner of this family group.')
          : $t('Leaving removes your access to shared meal diaries, recipes, and shopping lists.') }}
      </p>
      <div class="card-actions mt-auto">
        <button
          class="btn btn-error btn-outline"
          data-testid="leave-family-button"
          @click="openModal"
        >
          {{ $t('Leave family') }}
        </button>
      </div>
    </div>
  </div>

  <dialog ref="modal" class="modal">
    <div class="modal-box">
      <!-- Step: member confirms leave -->
      <template v-if="step === 'leave'">
        <h3 class="font-bold text-lg">{{ $t('Leave family') }}</h3>
        <p class="py-3">
          {{ $t('You will lose access to this family\'s meal diaries, recipes, and shopping lists. The shared content stays with the family.') }}
        </p>
        <div v-if="error" class="alert alert-error mt-2"><span>{{ error }}</span></div>
        <div class="modal-action">
          <button class="btn" :disabled="isBusy" @click="closeModal">{{ $t('Cancel') }}</button>
          <button
            class="btn btn-error"
            data-testid="confirm-leave-button"
            :disabled="isBusy"
            @click="handleLeave"
          >
            <span v-if="isBusy" class="loading loading-spinner loading-sm"></span>
            <span v-else>{{ $t('Leave family') }}</span>
          </button>
        </div>
      </template>

      <!-- Step: owner chooses transfer or delete -->
      <template v-else-if="step === 'owner-choice'">
        <h3 class="font-bold text-lg">{{ $t('You own this family group') }}</h3>
        <p class="py-3">
          {{ $t('Before you can leave, hand the family over to someone else or delete it for everyone.') }}
        </p>
        <div class="flex flex-col gap-2">
          <button
            class="btn btn-primary"
            data-testid="choose-transfer-button"
            :disabled="otherMembers.length === 0"
            @click="step = 'transfer'"
          >
            {{ $t('Transfer ownership') }}
          </button>
          <p v-if="otherMembers.length === 0" class="text-xs opacity-70 text-center">
            {{ $t('There are no other members to transfer to.') }}
          </p>
          <button
            class="btn btn-error btn-outline"
            data-testid="choose-delete-button"
            @click="step = 'delete'"
          >
            {{ $t('Delete family') }}
          </button>
        </div>
        <div class="modal-action">
          <button class="btn" @click="closeModal">{{ $t('Cancel') }}</button>
        </div>
      </template>

      <!-- Step: pick the new owner -->
      <template v-else-if="step === 'transfer'">
        <h3 class="font-bold text-lg">{{ $t('Transfer ownership') }}</h3>
        <p class="py-3">{{ $t('Choose the new owner of this family group.') }}</p>
        <select
          v-model="newOwnerId"
          class="select select-bordered w-full"
          data-testid="new-owner-select"
          :disabled="isBusy"
        >
          <option :value="null" disabled>{{ $t('Select a member') }}</option>
          <option v-for="member in otherMembers" :key="member.id" :value="member.id">
            {{ member.name }}
          </option>
        </select>
        <div v-if="error" class="alert alert-error mt-4"><span>{{ error }}</span></div>
        <div class="modal-action">
          <button class="btn" :disabled="isBusy" @click="step = 'owner-choice'">{{ $t('Back') }}</button>
          <button
            class="btn btn-primary"
            data-testid="confirm-transfer-button"
            :disabled="!newOwnerId || isBusy"
            @click="handleTransfer"
          >
            <span v-if="isBusy" class="loading loading-spinner loading-sm"></span>
            <span v-else>{{ $t('Transfer ownership') }}</span>
          </button>
        </div>
      </template>

      <!-- Step: type the family name to delete -->
      <template v-else-if="step === 'delete'">
        <h3 class="font-bold text-lg text-error">{{ $t('Delete family') }}</h3>
        <p class="py-3">
          {{ $t('This permanently deletes the family group for every member: all meal diaries, recipes, and shopping lists. Members keep their accounts and can create or join another family.') }}
        </p>
        <div class="form-control">
          <label class="label">
            <span class="label-text">
              {{ $t('Type the family name to confirm:') }} <strong>{{ familyGroup.name }}</strong>
            </span>
          </label>
          <input
            type="text"
            v-model="deleteNameInput"
            class="input input-bordered w-full"
            data-testid="delete-family-name-input"
            :placeholder="familyGroup.name"
            :disabled="isBusy"
          />
        </div>
        <div v-if="error" class="alert alert-error mt-4"><span>{{ error }}</span></div>
        <div class="modal-action">
          <button class="btn" :disabled="isBusy" @click="step = isOwner ? 'owner-choice' : 'leave'">{{ $t('Back') }}</button>
          <button
            class="btn btn-error"
            data-testid="confirm-delete-family-button"
            :disabled="deleteNameInput !== familyGroup.name || isBusy"
            @click="handleDelete"
          >
            <span v-if="isBusy" class="loading loading-spinner loading-sm"></span>
            <span v-else>{{ $t('Delete family') }}</span>
          </button>
        </div>
      </template>

      <!-- Step: ownership transferred -->
      <template v-else-if="step === 'transferred'">
        <h3 class="font-bold text-lg">{{ $t('Ownership transferred') }}</h3>
        <p class="py-3">{{ $t('You are now a regular member and can leave the family whenever you like.') }}</p>
        <div class="modal-action">
          <button class="btn" @click="closeModal">{{ $t('Close') }}</button>
          <button class="btn btn-error" data-testid="leave-after-transfer-button" @click="step = 'leave'">
            {{ $t('Leave family') }}
          </button>
        </div>
      </template>
    </div>
    <form method="dialog" class="modal-backdrop"><button :disabled="isBusy">{{ $t('close') }}</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useFamilyStore } from '~/stores/family';
import { useUserStore } from '~/stores/user';

const { t } = useI18n();
const userStore = useUserStore();
const familyStore = useFamilyStore();
const { familyGroup, members } = storeToRefs(familyStore);
const { api } = useApi();

const modal = ref<HTMLDialogElement | null>(null);
const step = ref<'leave' | 'owner-choice' | 'transfer' | 'delete' | 'transferred'>('leave');
const newOwnerId = ref<number | null>(null);
const deleteNameInput = ref('');
const error = ref('');
const isBusy = ref(false);

const isOwner = computed(
  () => familyGroup.value?.created_by === userStore.user?.id
);
const otherMembers = computed(
  () => members.value.filter((member) => member.id !== userStore.user?.id)
);

const openModal = () => {
  step.value = isOwner.value ? 'owner-choice' : 'leave';
  newOwnerId.value = null;
  deleteNameInput.value = '';
  error.value = '';
  modal.value?.showModal();
};

const closeModal = () => {
  modal.value?.close();
};

// Shared data is gone from this user's perspective — reset local caches and
// send them to the create/join family screen
const exitFamilyLocally = async () => {
  familyStore.clearCache();
  familyStore.familyGroup = null;
  await userStore.fetchUser().catch(() => {});
  closeModal();
  await navigateTo('/registration/step-2');
};

const handleLeave = async () => {
  error.value = '';
  isBusy.value = true;
  try {
    await api(`/api/family-groups/${familyGroup.value!.id}/leave`, { method: 'POST' });
    await exitFamilyLocally();
  } catch (err: any) {
    error.value = err?.data?.message || err?.message || t('Failed to leave family group');
  } finally {
    isBusy.value = false;
  }
};

const handleTransfer = async () => {
  error.value = '';
  isBusy.value = true;
  try {
    await api(`/api/family-groups/${familyGroup.value!.id}/transfer-ownership`, {
      method: 'POST',
      body: { new_owner_id: newOwnerId.value },
    });
    // Refresh so the owner badge and isOwner flip to the new owner
    familyStore.clearCache();
    await familyStore.fetchFamilyGroup().catch(() => {});
    await familyStore.fetchMembers().catch(() => {});
    step.value = 'transferred';
  } catch (err: any) {
    error.value = err?.data?.message || err?.message || t('Failed to transfer ownership');
  } finally {
    isBusy.value = false;
  }
};

const handleDelete = async () => {
  error.value = '';
  isBusy.value = true;
  try {
    await api(`/api/family-groups/${familyGroup.value!.id}`, { method: 'DELETE' });
    await exitFamilyLocally();
  } catch (err: any) {
    error.value = err?.data?.message || err?.message || t('Failed to delete family group');
  } finally {
    isBusy.value = false;
  }
};
</script>
