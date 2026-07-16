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
            v-for="slot in mealSlots"
            :key="slot.type"
            class="mb-3 flex items-center gap-3"
            :data-testid="`${slot.type}-row`"
          >
            <h3 class="shrink-0">{{ slot.label }}</h3>
            <div
              v-if="slot.meal?.name"
              class="flex min-w-0 flex-1 items-center justify-end gap-1.5"
            >
              <span
                v-if="slot.meal.recipeId"
                class="badge badge-primary min-w-0 max-w-full cursor-pointer truncate"
                :data-testid="`${slot.type}-recipe-badge`"
                :title="slot.meal.name"
                @click.stop="handleNavigateToRecipe(slot.meal.recipeId)"
              >
                {{ slot.meal.name }}
              </span>
              <span
                v-else
                class="badge badge-primary min-w-0 max-w-full truncate"
                :class="{ 'cursor-pointer': !readOnly }"
                :data-testid="`${slot.type}-custom-badge`"
                :title="slot.meal.name"
                @click="!readOnly && $emit('setMeal', slot.type)"
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
                :data-testid="`edit-${slot.type}-button`"
                @click.stop="$emit('setMeal', slot.type)"
              >
                <fa :icon="['fas', 'pencil']" class="text-xs" />
              </button>
            </div>
            <button
              v-else-if="!readOnly"
              class="btn btn-xs ml-auto"
              :data-testid="`set-meal-${slot.type}-button`"
              @click="$emit('setMeal', slot.type)"
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

const mealSlots = computed(() => [
  { type: 'breakfast', label: t('Breakfast'), meal: props.breakfast },
  { type: 'lunch', label: t('Lunch'), meal: props.lunch },
  { type: 'dinner', label: t('Dinner'), meal: props.dinner },
]);

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
