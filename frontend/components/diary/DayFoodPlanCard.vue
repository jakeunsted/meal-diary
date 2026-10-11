<template>
  <div class="animate-fade-in">
    <div class="card bg-base-200 shadow-sm m-4" data-testid="day-food-plan-card">
      <div class="card-title justify-between my-2 flex items-center px-6" data-testid="day-card-toggle" @click="toggleCard">
        <div class="font-semibold">{{ day }} - {{ date }}</div>
        <fa :icon="isOpen ? 'chevron-up' : 'chevron-down'" />
      </div>
      <div class="card-body bg-base-300 rounded-b-lg" v-if="isOpen">
        <div class="card-content">
          <div
            v-for="slot in displaySlots"
            :key="slot.key"
            class="mb-3 flex items-center gap-3"
            :data-testid="`${slot.testIdPrefix}-row`"
          >
            <h3 class="shrink-0">{{ slot.label }}</h3>
            <div
              v-if="slot.meal?.name"
              class="flex min-w-0 flex-1 items-center justify-end gap-1.5"
            >
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
                @click="!readOnly && $emit('setMeal', slot.emitPayload)"
              >
                {{ slot.meal.name }}
              </span>
              <fa
                v-if="slot.meal.recipeId"
                :icon="['fas', 'book-open']"
                class="shrink-0 text-xs opacity-70"
              />
              <button
                v-if="!readOnly"
                class="btn btn-ghost btn-xs btn-circle shrink-0"
                :data-testid="`edit-${slot.testIdPrefix}-button`"
                @click.stop="$emit('setMeal', slot.emitPayload)"
              >
                <fa :icon="['fas', 'pencil']" class="text-xs" />
              </button>
            </div>
            <button
              v-else-if="!readOnly"
              class="btn btn-xs ml-auto"
              :data-testid="`set-meal-${slot.testIdPrefix}-button`"
              @click="$emit('setMeal', slot.emitPayload)"
            >
              {{ $t('Set Meal +') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const router = useRouter();
const { t } = useI18n();

const props = defineProps({
  day: {
    required: true,
    type: String,
  },
  date: {
    required: true,
    type: String,
  },
  breakfast: {
    required: false,
    type: Object,
  },
  lunch: {
    required: false,
    type: Object,
  },
  dinner: {
    required: false,
    type: Object,
  },
  slots: {
    required: false,
    type: Array,
    default: () => [],
  },
  isPastDay: {
    required: false,
    type: Boolean,
    default: false
  },
  readOnly: {
    required: false,
    type: Boolean,
    default: false,
  },
});

defineEmits(['setMeal']);

const isOpen = ref(!props.isPastDay);

watch(() => props.isPastDay, (newValue) => {
  isOpen.value = !newValue;
});

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

const toggleCard = () => {
  isOpen.value = !isOpen.value;
};

const handleNavigateToRecipe = (recipeId) => {
  if (recipeId) {
    router.push(`/recipes/${recipeId}`);
  }
};
</script>

<style>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
</style>
