<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <button
      type="button"
      class="btn btn-ghost btn-sm -ml-2 mb-4"
      data-testid="integrations-back"
      @click="handleBack"
    >
      {{ $t('Back') }}
    </button>

    <h1 class="text-2xl font-bold">{{ $t('integrations.title') }}</h1>
    <p class="mt-2 mb-8 opacity-70">{{ $t('integrations.description') }}</p>

    <div v-if="!flagReady" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-md"></span>
    </div>

    <p v-else-if="!familyGroup" class="opacity-70">
      {{ $t('integrations.familyRequired') }}
    </p>

    <p v-else-if="!alexaConnectionEnabled" class="opacity-70" data-testid="integrations-empty">
      {{ $t('integrations.empty') }}
    </p>

    <div v-else class="flex flex-col gap-4" data-testid="integrations-list">
      <AlexaIntegrationCard />
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { FEATURE_FLAGS } from '@meal-diary/shared';
import { useFamilyStore } from '~/stores/family';
import { useUserStore } from '~/stores/user';
import AlexaIntegrationCard from '~/components/profile/AlexaIntegrationCard.vue';

definePageMeta({
  middleware: 'auth',
});

const userStore = useUserStore();
const familyStore = useFamilyStore();
const { familyGroup } = storeToRefs(familyStore);
const { refreshEntitlements } = useEntitlements();
const { enabled: alexaConnectionEnabled, ready: flagReady } = useFeatureFlag(FEATURE_FLAGS.alexaConnection);

const handleBack = () => {
  navigateTo('/profile');
};

onMounted(async () => {
  if (!userStore.user) {
    await userStore.fetchUser().catch(() => {});
  }

  const familyId = userStore.user?.family_group_id;
  if (familyId && !familyGroup.value) {
    await familyStore.fetchFamilyGroup().catch(() => {});
  }
  if (familyId) {
    await refreshEntitlements().catch(() => {});
  }
});
</script>
