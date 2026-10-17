<script setup lang="ts">
const { t } = useI18n();
const { plansLink } = useAppLinks();
const { trackPlansCta } = useMarketingAnalytics();

const rows = computed(() => [
  {
    key: 'familyMembers',
    label: t('pricing.rows.familyMembers'),
    free: t('pricing.values.freeMembers'),
    plus: t('pricing.values.plusMembers'),
  },
  {
    key: 'weeksAhead',
    label: t('pricing.rows.weeksAhead'),
    free: t('pricing.values.freeWeeks'),
    plus: t('pricing.values.plusWeeks'),
  },
  {
    key: 'editPastWeeks',
    label: t('pricing.rows.editPastWeeks'),
    free: t('pricing.values.no'),
    plus: t('pricing.values.yes'),
  },
  {
    key: 'recipes',
    label: t('pricing.rows.recipes'),
    free: t('pricing.values.freeRecipes'),
    plus: t('pricing.values.plusRecipes'),
  },
  {
    key: 'recipeToShopping',
    label: t('pricing.rows.recipeToShopping'),
    free: t('pricing.values.no'),
    plus: t('pricing.values.yes'),
  },
  {
    key: 'customSlots',
    label: t('pricing.rows.customSlots'),
    free: t('pricing.values.no'),
    plus: t('pricing.values.yes'),
  },
]);

const handlePlansCta = () => {
  trackPlansCta('pricing');
};
</script>

<template>
  <div class="space-y-8">
    <div class="grid gap-6 md:grid-cols-2">
      <article class="rounded-2xl border border-white/10 bg-ink-900/80 p-6 shadow-sm backdrop-blur">
        <h2 class="font-display text-2xl font-semibold text-white">
          {{ t('pricing.free.name') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-ink-300">
          {{ t('pricing.free.summary') }}
        </p>
      </article>
      <article class="rounded-2xl border border-brand-500/50 bg-brand-500/15 p-6 shadow-sm backdrop-blur">
        <h2 class="font-display text-2xl font-semibold text-brand-200">
          {{ t('pricing.familyPlus.name') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-ink-200">
          {{ t('pricing.familyPlus.summary') }}
        </p>
        <p class="mt-3 text-xs font-medium text-brand-300">
          {{ t('pricing.familyPlus.trial') }}
        </p>
      </article>
    </div>

    <div class="overflow-x-auto rounded-2xl border border-white/10 bg-ink-900/85 shadow-sm">
      <table class="w-full min-w-[32rem] text-left text-sm">
        <thead class="border-b border-white/10 bg-ink-800/80">
          <tr>
            <th class="px-4 py-3 font-semibold text-ink-100">
              {{ t('pricing.rows.feature') }}
            </th>
            <th class="px-4 py-3 text-center font-semibold text-ink-100">
              {{ t('pricing.free.name') }}
            </th>
            <th class="px-4 py-3 text-center font-semibold text-ink-100">
              {{ t('pricing.familyPlus.name') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.key"
            class="border-b border-white/5 last:border-0"
          >
            <td class="px-4 py-3 text-ink-200">
              {{ row.label }}
            </td>
            <td class="px-4 py-3 text-center text-ink-100">
              {{ row.free }}
            </td>
            <td class="px-4 py-3 text-center font-medium text-brand-300">
              {{ row.plus }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-sm text-ink-400">
      {{ t('pricing.note') }}
    </p>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <UButton
        :to="plansLink('pricing')"
        color="primary"
        size="xl"
        @click="handlePlansCta"
      >
        {{ t('pricing.cta') }}
      </UButton>
      <StoreCtaComingSoon placement="pricing" compact />
    </div>
  </div>
</template>
