<template>
  <div class="flex min-w-[8.5rem] flex-col rounded-box bg-base-100 p-2" data-testid="diary-day-column">
    <div class="mb-2 px-1">
      <div class="font-semibold leading-tight">{{ day }}</div>
      <div class="text-xs opacity-70">{{ date }}</div>
    </div>
    <div
      v-for="slot in displaySlots"
      :key="slot.key"
      class="mb-2"
      :data-testid="`${slot.testIdPrefix}-row`"
    >
      <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">{{ slot.label }}</h3>
      <div v-if="slot.meal?.name" class="flex min-w-0 items-center gap-1">
        <span
          v-if="slot.meal.recipeId"
          class="badge badge-primary min-w-0 max-w-full cursor-pointer truncate"
          :data-testid="`${slot.testIdPrefix}-recipe-badge`"
          :title="slot.meal.name"
          @click.stop="handleNavigateToRecipe(slot.meal.recipeId)"
        >
          {{ slot.meal.name }}
        </span>
        <span
          v-else
          class="badge badge-primary min-w-0 max-w-full truncate"
          :class="{ 'cursor-pointer': !readOnly }"
          :data-testid="`${slot.testIdPrefix}-custom-badge`"
          :title="slot.meal.name"
          @click="!readOnly && emit('setMeal', slot.emitPayload)"
        >
          {{ slot.meal.name }}
        </span>
        <button
          v-if="!readOnly"
          type="button"
          class="btn btn-ghost btn-xs btn-circle shrink-0"
          :data-testid="`edit-${slot.testIdPrefix}-button`"
          @click.stop="emit('setMeal', slot.emitPayload)"
        >
          <fa :icon="['fas', 'pencil']" class="text-xs" />
        </button>
      </div>
      <button
        v-else-if="!readOnly"
        type="button"
        class="btn btn-xs w-full"
        :data-testid="`set-meal-${slot.testIdPrefix}-button`"
        @click="emit('setMeal', slot.emitPayload)"
      >
        {{ $t('Set Meal +') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface MealValue {
  name?: string | null;
  recipeId?: number | null;
}

interface MealSlotEntry {
  position: number;
  legacy_key?: string | null;
  meal_slot_id: number;
  name: string;
  dish?: string | null;
  recipe_id?: number | null;
}

interface SetMealEmitPayload {
  type: string;
  mealSlotId: number | null;
}

const props = defineProps<{
  day: string;
  date: string;
  breakfast?: MealValue;
  lunch?: MealValue;
  dinner?: MealValue;
  slots?: MealSlotEntry[];
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  setMeal: [payload: SetMealEmitPayload];
}>();

const router = useRouter();
const { t } = useI18n();

const displaySlots = computed(() => {
  if (props.slots?.length) {
    return [...props.slots]
      .sort((a, b) => a.position - b.position)
      .map((slot) => {
        const legacy = slot.legacy_key;
        const testIdPrefix = legacy || `slot-${slot.meal_slot_id}`;
        return {
          key: slot.meal_slot_id,
          label: slot.name,
          testIdPrefix,
          meal: {
            name: slot.dish,
            recipeId: slot.recipe_id,
          },
          emitPayload: {
            type: legacy || `slot-${slot.meal_slot_id}`,
            mealSlotId: slot.meal_slot_id,
          },
        };
      });
  }

  return [
    {
      key: 'breakfast',
      label: t('Breakfast'),
      testIdPrefix: 'breakfast',
      meal: props.breakfast,
      emitPayload: { type: 'breakfast', mealSlotId: null },
    },
    {
      key: 'lunch',
      label: t('Lunch'),
      testIdPrefix: 'lunch',
      meal: props.lunch,
      emitPayload: { type: 'lunch', mealSlotId: null },
    },
    {
      key: 'dinner',
      label: t('Dinner'),
      testIdPrefix: 'dinner',
      meal: props.dinner,
      emitPayload: { type: 'dinner', mealSlotId: null },
    },
  ];
});

const handleNavigateToRecipe = (recipeId?: number | null) => {
  if (recipeId) {
    router.push(`/recipes/${recipeId}`);
  }
};
</script>
