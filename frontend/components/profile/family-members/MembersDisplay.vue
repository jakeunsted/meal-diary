<template>
  <div>
    <div v-if="members.length > 0">
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-6">
        <div v-for="member in members" :key="member.id"
          class="flex flex-col items-center p-4 bg-base-200 rounded-xl hover:bg-base-300 transition-colors">
          <div class="avatar mb-3">
            <div class="w-16 h-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
              <img
                :src="member.avatar_url || '/temp-avatars/generic-avatar.png'"
                :alt="member.name"
                class="w-full h-full rounded-full object-cover"
              />
            </div>
          </div>
          <h3 class="font-semibold text-center">{{ member.name }}</h3>
          <span
            v-if="member.id === ownerId"
            class="badge badge-primary badge-sm mt-1"
            data-testid="owner-badge"
          >
            {{ $t('Owner') }}
          </span>
        </div>
      </div>
    </div>
    <div v-else class="flex flex-col items-center justify-center mx-auto p-4 rounded-xl">
      <h3 class="font-semibold">{{ $t('Wow its empty here!') }}</h3>
    </div>
    <div class="flex flex-col items-center justify-center mx-auto rounded-xl">
      <p
        v-if="!canAddFamilyMember && memberLimitMessage"
        class="text-sm text-center opacity-80 mt-4 max-w-md"
        data-testid="profile-family-member-limit-message"
      >
        {{ memberLimitMessage }}
        <NuxtLink
          v-if="showUpgradeLink"
          class="link link-primary"
          to="/plans"
        >
          {{ $t('profilePage.viewPlansToUpgrade') }}
        </NuxtLink>
      </p>
      <button
        class="btn btn-primary mt-4"
        data-testid="profile-add-family-member-button"
        :disabled="!canAddFamilyMember"
        @click="handleAddFamilyMember"
      >
        {{ $t('Add family member') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DisplayMember } from '../../../types/FamilyGroup';

defineProps({
  members: {
    type: Array as () => DisplayMember[],
    required: true,
  },
  ownerId: {
    type: Number as () => number | null | undefined,
    default: null,
  },
  canAddFamilyMember: {
    type: Boolean,
    default: true,
  },
  memberLimitMessage: {
    type: String,
    default: '',
  },
  showUpgradeLink: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits<{
  (e: 'addFamilyMember'): void;
}>();

const handleAddFamilyMember = () => {
  emit('addFamilyMember');
};
</script>

<script lang="ts">
export default {
  name: 'MembersDisplay',
};
</script>