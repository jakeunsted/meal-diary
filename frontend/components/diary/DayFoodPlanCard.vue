<template>
  <div class="animate-fade-in">
    <div class="card bg-base-200 shadow-sm m-4">
      <div class="card-title justify-between my-2 flex items-center px-6" @click="toggleCard">
        <div class="font-semibold">{{ day }}</div>
        <fa :icon="isOpen ? 'chevron-up' : 'chevron-down'" />
      </div>
      <div class="card-body bg-base-300 rounded-b-lg" v-if="isOpen">
        <div class="card-content">
          <div class="flex justify-between mb-2">
            <h3 class="">Breakfast</h3>
            <div v-if="breakfast && breakfast.name">
              <span class="badge badge-info" @click="$emit('setMeal', 'breakfast')">{{ breakfast.name }}</span>
            </div>
            <button v-else class="btn btn-xs" @click="$emit('setMeal', 'breakfast')">Set Meal +</button>
          </div>
          <div class="flex justify-between mb-2">
            <h3 class="">Lunch</h3>
            <div v-if="lunch && lunch.name">
              <span class="badge badge-info" @click="$emit('setMeal', 'lunch')">{{ lunch.name }}</span>
            </div>
            <button v-else class="btn btn-xs" @click="$emit('setMeal', 'lunch')">Set Meal +</button>
          </div>
          <div class="flex justify-between mb-2">
            <h3 class="">Dinner</h3>
            <div v-if="dinner && dinner.name">
              <span class="badge badge-info" @click="$emit('setMeal', 'dinner')">{{ dinner.name }}</span>
            </div>
            <button v-else class="btn btn-xs" @click="$emit('setMeal', 'dinner')">Set Meal +</button>
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
