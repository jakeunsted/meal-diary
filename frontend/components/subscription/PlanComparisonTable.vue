<template>
  <div class="overflow-x-auto">
    <table class="table table-zebra w-full">
      <thead>
        <tr>
          <th>{{ $t('plansPage.feature') }}</th>
          <th class="text-center">{{ $t('plansPage.free') }}</th>
          <th class="text-center">{{ $t('plansPage.familyPlus') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <td>{{ $t(row.labelKey) }}</td>
          <td class="text-center">{{ row.free }}</td>
          <td class="text-center">{{ row.premium }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
const rows = [
  {
    key: 'family_members',
    labelKey: 'plansPage.rows.familyMembers',
    free: '2',
    premium: '8',
  },
  {
    key: 'weeks_ahead',
    labelKey: 'plansPage.rows.weeksAhead',
    free: '1',
    premium: '∞',
  },
  {
    key: 'edit_past_weeks',
    labelKey: 'plansPage.rows.editPastWeeks',
    free: '✗',
    premium: '✓',
  },
  {
    key: 'recipes',
    labelKey: 'plansPage.rows.recipes',
    free: '10',
    premium: '∞',
  },
  {
    key: 'recipe_to_shopping_list',
    labelKey: 'plansPage.rows.recipeToShoppingList',
    free: '✗',
    premium: '✓',
  },
];
</script>
