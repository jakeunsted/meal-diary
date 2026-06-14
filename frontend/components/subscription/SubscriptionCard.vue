<template>
  <div class="card bg-base-200 h-full">
    <div class="card-body">
      <h2 class="card-title">{{ $t('plansPage.subscription') }}</h2>
      <p v-if="subscriptionStore.loading" class="text-sm opacity-70">
        <span class="loading loading-spinner loading-sm"></span>
      </p>
      <template v-else>
        <p class="text-sm opacity-70">
          {{ $t('plansPage.currentPlanLabel', { plan: planLabel }) }}
        </p>
        <p
          v-if="entitlements?.trial"
          class="text-sm text-primary"
        >
          {{ $t('plansPage.trialDaysRemaining', { days: entitlements.trial.daysRemaining }) }}
        </p>
      </template>
      <div class="card-actions mt-auto">
        <NuxtLink class="btn btn-primary btn-sm" to="/plans">
          {{ $t('plansPage.viewPlans') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
const subscriptionStore = useSubscriptionStore();
const { entitlements, currentPlan } = useEntitlements();
const { t } = useI18n();

const planLabel = computed(() => {
  if (currentPlan.value === 'premium') {
    return t('plansPage.familyPlus');
  }
  return t('plansPage.free');
});
</script>
