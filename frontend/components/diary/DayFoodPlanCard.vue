<template>
  <div class="animate-fade-in">
    <div class="card bg-base-200 shadow-sm m-4" data-testid="day-food-plan-card">
      <div class="card-title justify-between my-2 flex items-center px-6" data-testid="day-card-toggle" @click="toggleCard">
        <div class="font-semibold">{{ day }} - {{ date }}</div>
        <fa :icon="isOpen ? 'chevron-up' : 'chevron-down'" />
      </div>
      <div class="card-body bg-base-300 rounded-b-lg" v-if="isOpen">
        <div class="card-content">
          <div class="flex justify-between mb-3 items-center" data-testid="breakfast-row">
            <h3 class="">{{ $t('Breakfast') }}</h3>
            <div v-if="breakfast && breakfast.name" class="flex items-center gap-1">
              <span
                v-if="breakfast.recipeId"
                class="badge badge-primary cursor-pointer"
                data-testid="breakfast-recipe-badge"
                @click.stop="handleNavigateToRecipe(breakfast.recipeId)"
              >
                {{ breakfast.name }}
                <fa :icon="['fas', 'book-open']" class="ml-2 text-xs" />
              </span>
              <span
                v-else
                class="badge badge-primary"
                data-testid="breakfast-custom-badge"
                @click="$emit('setMeal', 'breakfast')"
              >
                {{ breakfast.name }}
                <fa :icon="['fas', 'pencil']" class="ml-2 text-xs" />
              </span>
              <button
                v-if="breakfast.recipeId"
                class="btn btn-ghost btn-xs btn-circle"
                data-testid="edit-breakfast-button"
                @click.stop="$emit('setMeal', 'breakfast')"
              >
                <fa :icon="['fas', 'pencil']" class="text-xs" />
              </button>
            </div>
            <button v-else class="btn btn-xs" data-testid="set-meal-breakfast-button" @click="$emit('setMeal', 'breakfast')">{{ $t('Set Meal +') }}</button>
          </div>
          <div class="flex justify-between mb-3 items-center" data-testid="lunch-row">
            <h3 class="">{{ $t('Lunch') }}</h3>
            <div v-if="lunch && lunch.name" class="flex items-center gap-1">
              <span
                v-if="lunch.recipeId"
                class="badge badge-primary cursor-pointer"
                data-testid="lunch-recipe-badge"
                @click.stop="handleNavigateToRecipe(lunch.recipeId)"
              >
                {{ lunch.name }}
                <fa :icon="['fas', 'book-open']" class="ml-2 text-xs" />
              </span>
              <span
                v-else
                class="badge badge-primary"
                data-testid="lunch-custom-badge"
                @click="$emit('setMeal', 'lunch')"
              >
                {{ lunch.name }}
                <fa :icon="['fas', 'pencil']" class="ml-2 text-xs" />
              </span>
              <button
                v-if="lunch.recipeId"
                class="btn btn-ghost btn-xs btn-circle"
                data-testid="edit-lunch-button"
                @click.stop="$emit('setMeal', 'lunch')"
              >
                <fa :icon="['fas', 'pencil']" class="text-xs" />
              </button>
            </div>
            <button v-else class="btn btn-xs" data-testid="set-meal-lunch-button" @click="$emit('setMeal', 'lunch')">{{ $t('Set Meal +') }}</button>
          </div>
          <div class="flex justify-between mb-3 items-center" data-testid="dinner-row">
            <h3 class="">{{ $t('Dinner') }}</h3>
            <div v-if="dinner && dinner.name" class="flex items-center gap-1">
              <span
                v-if="dinner.recipeId"
                class="badge badge-primary cursor-pointer"
                data-testid="dinner-recipe-badge"
                @click.stop="handleNavigateToRecipe(dinner.recipeId)"
              >
                {{ dinner.name }}
                <fa :icon="['fas', 'book-open']" class="ml-2 text-xs" />
              </span>
              <span
                v-else
                class="badge badge-primary"
                data-testid="dinner-custom-badge"
                @click="$emit('setMeal', 'dinner')"
              >
                {{ dinner.name }}
                <fa :icon="['fas', 'pencil']" class="ml-2 text-xs" />
              </span>
              <button
                v-if="dinner.recipeId"
                class="btn btn-ghost btn-xs btn-circle"
                data-testid="edit-dinner-button"
                @click.stop="$emit('setMeal', 'dinner')"
              >
                <fa :icon="['fas', 'pencil']" class="text-xs" />
              </button>
            </div>
            <button v-else class="btn btn-xs" data-testid="set-meal-dinner-button" @click="$emit('setMeal', 'dinner')">{{ $t('Set Meal +') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const router = useRouter();

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
  }
});

defineEmits(['setMeal']);

const isOpen = ref(!props.isPastDay);

watch(() => props.isPastDay, (newValue) => {
  isOpen.value = !newValue;
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
