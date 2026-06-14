<template>
  <div class="min-h-screen bg-base-100">
    <div class="max-w-4xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">{{ $t('plansPage.title') }}</h1>
        <button
          v-if="showBack"
          type="button"
          class="btn btn-ghost btn-sm"
          @click="handleBack"
        >
          {{ $t('Back') }}
        </button>
      </div>

      <p class="mb-6 leading-relaxed opacity-80">{{ $t('plansPage.intro') }}</p>

      <div v-if="isLoggedIn && entitlements" class="alert alert-info mb-6">
        <span>
          {{ $t('plansPage.currentPlanLabel', { plan: currentPlanLabel }) }}
          <template v-if="entitlements.trial">
            — {{ $t('plansPage.trialDaysRemaining', { days: entitlements.trial.daysRemaining }) }}
          </template>
        </span>
      </div>

      <h2 class="text-lg font-semibold mb-4">{{ $t('plansPage.compareTitle') }}</h2>
      <PlanComparisonTable class="mb-8" />

      <h2 class="text-lg font-semibold mb-4">{{ $t('plansPage.pricingTitle') }}</h2>
      <PricingCards
        :is-logged-in="isLoggedIn"
        :is-owner="billing.isOwner"
        :owner-display-name="billing.ownerDisplayName"
        class="mb-8"
      />

      <LegalLinks />
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false,
});

import PlanComparisonTable from '~/components/subscription/PlanComparisonTable.vue';
import PricingCards from '~/components/subscription/PricingCards.vue';
import LegalLinks from '~/components/LegalLinks.vue';

const authStore = useAuthStore();
const userStore = useUserStore();
const { entitlements, billing, currentPlan, refreshEntitlements } = useEntitlements();
const { t } = useI18n();
const route = useRoute();

const isLoggedIn = computed(() => authStore.isAuthenticated);

const currentPlanLabel = computed(() =>
  currentPlan.value === 'premium' ? t('plansPage.familyPlus') : t('plansPage.free')
);

const showBack = computed(() => route.query.from !== 'login');

const handleBack = () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigateTo(isLoggedIn.value ? '/profile' : '/login');
  }
};

onMounted(async () => {
  if (authStore.isAuthenticated && !userStore.user) {
    await userStore.fetchUser();
  }

  if (userStore.user?.family_group_id) {
    await refreshEntitlements();
  }
});
</script>
