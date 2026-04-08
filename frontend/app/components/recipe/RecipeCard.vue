<template>
  <div class="card bg-base-200 shadow-sm cursor-pointer hover:bg-base-300 transition-colors" :data-testid="`recipe-card-${recipe.id}`" @click="$emit('click')">
    <div class="card-body p-4">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h3 class="card-title text-base">{{ recipe.name }}</h3>
          <p v-if="recipe.description" class="text-sm text-base-content/60 mt-1 line-clamp-2">
            {{ recipe.description }}
          </p>
        </div>
        <div class="flex gap-2 items-center text-sm text-base-content/50">
          <span v-if="recipe.portions" class="badge badge-ghost badge-sm">
            {{ recipe.portions }} {{ $t('portions') }}
          </span>
          <span v-if="recipe.ingredients?.length" class="badge badge-ghost badge-sm">
            {{ recipe.ingredients.length }} {{ recipe.ingredients.length === 1 ? $t('ingredient') : $t('ingredients') }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  recipe: {
    type: Object,
    required: true,
  },
});

defineEmits(['click']);
</script>
