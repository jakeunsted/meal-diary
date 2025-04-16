<template>
  <div class="animate-fade-in">
    <div class="card bg-base-200 shadow-sm m-4">
      <div class="card-title justify-between my-2 flex items-center px-6" @click="toggleCard">
        <div class="font-semibold">{{ day }} - {{ date }}</div>
        <fa :icon="isOpen ? 'chevron-up' : 'chevron-down'" />
      </div>
      <div class="card-body bg-base-300 rounded-b-lg" v-if="isOpen">
        <div class="card-content">
          <div class="flex justify-between mb-3 items-center">
            <h3 class="">{{ $t('Breakfast') }}</h3>
            <div v-if="breakfast && breakfast.name" @click="$emit('setMeal', 'breakfast')">
              <span class="badge badge-primary" >
                {{ breakfast.name }}
                <fa :icon="['fas', 'pencil']" class="ml-2 text-xs" />
              </span>
            </div>
            <button v-else class="btn btn-xs" @click="$emit('setMeal', 'breakfast')">{{ $t('Set Meal +') }}</button>
          </div>
          <div class="flex justify-between mb-3 items-center">
            <h3 class="">{{ $t('Lunch') }}</h3>
            <div v-if="lunch && lunch.name" @click="$emit('setMeal', 'lunch')">
              <span class="badge badge-primary" >
                {{ lunch.name }}
                <fa :icon="['fas', 'pencil']" class="ml-2 text-xs" />
              </span>
            </div>
            <button v-else class="btn btn-xs" @click="$emit('setMeal', 'lunch')">{{ $t('Set Meal +') }}</button>
          </div>
          <div class="flex justify-between mb-3 items-center">
            <h3 class="">{{ $t('Dinner') }}</h3>
            <div v-if="dinner && dinner.name" @click="$emit('setMeal', 'dinner')">
              <span class="badge badge-primary" >
                {{ dinner.name }}
                <fa :icon="['fas', 'pencil']" class="ml-2 text-xs" />
              </span>
            </div>
            <button v-else class="btn btn-xs" @click="$emit('setMeal', 'dinner')">{{ $t('Set Meal +') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
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
})

defineEmits(['setMeal'])

const isOpen = ref(true);

const toggleCard = () => {
  isOpen.value = !isOpen.value;
}
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
