import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Recipe } from '@/types/recipe';

const CACHE_PREFIX = 'recipes-cache';

function buildCacheKey(familyGroupId: number): string {
  return `${CACHE_PREFIX}:${familyGroupId}`;
}

function parseRecipes(raw: string | null): Recipe[] | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Recipe[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function loadFamilyRecipesCache(familyGroupId: number): Promise<Recipe[] | null> {
  try {
    const recipes = parseRecipes(await AsyncStorage.getItem(buildCacheKey(familyGroupId)));
    if (!recipes) {
      await AsyncStorage.removeItem(buildCacheKey(familyGroupId));
    }
    return recipes;
  } catch (error) {
    console.warn('[recipeStorage] Failed to load cache', error);
    return null;
  }
}

export async function saveFamilyRecipesCache(
  familyGroupId: number,
  recipes: Recipe[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(buildCacheKey(familyGroupId), JSON.stringify(recipes));
  } catch (error) {
    console.warn('[recipeStorage] Failed to save cache', error);
  }
}

export async function loadCachedRecipe(recipeId: number): Promise<Recipe | null> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith(`${CACHE_PREFIX}:`));
    for (const key of cacheKeys) {
      const recipes = parseRecipes(await AsyncStorage.getItem(key));
      const match = recipes?.find((recipe) => recipe.id === recipeId);
      if (match) {
        return match;
      }
    }
    return null;
  } catch (error) {
    console.warn('[recipeStorage] Failed to find cached recipe', error);
    return null;
  }
}
