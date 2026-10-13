<template>
  <div class="grid gap-3" data-testid="recipes-compact">
    <RecipeCard
      v-for="recipe in recipes"
      :key="recipe.id"
      :recipe="recipe"
      @click="emit('open', recipe.id)"
    />
  </div>
</template>

<script setup lang="ts">
import type { Recipe } from '~/types/Recipe';
import RecipeCard from '~/components/recipe/RecipeCard.vue';

defineProps<{
  recipes: Recipe[];
}>();

const emit = defineEmits<{
  open: [id: number];
}>();
</script>
