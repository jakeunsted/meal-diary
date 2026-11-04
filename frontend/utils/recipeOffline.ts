import type { Recipe, RecipePendingEdit } from '~/types/Recipe';
import { browserStorage } from '~/utils/browserStorage';

export const recipesCacheKey = (familyGroupId: number): string => `recipes:${familyGroupId}`;

export const recipePendingKey = (familyGroupId: number): string => `recipePending:${familyGroupId}`;

export function readRecipesCache(familyGroupId: number): Recipe[] {
  const raw = browserStorage.get(recipesCacheKey(familyGroupId));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as Recipe[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    browserStorage.remove(recipesCacheKey(familyGroupId));
    return [];
  }
}

export function writeRecipesCache(familyGroupId: number, recipes: Recipe[]): void {
  browserStorage.set(recipesCacheKey(familyGroupId), JSON.stringify(recipes));
}

export function readPendingEdits(familyGroupId: number): RecipePendingEdit[] {
  const raw = browserStorage.get(recipePendingKey(familyGroupId));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as RecipePendingEdit[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((edit) =>
      edit && typeof edit.recipeId === 'number' && edit.baseline && edit.recipe
    );
  } catch {
    browserStorage.remove(recipePendingKey(familyGroupId));
    return [];
  }
}

export function writePendingEdits(familyGroupId: number, edits: RecipePendingEdit[]): void {
  if (edits.length === 0) {
    browserStorage.remove(recipePendingKey(familyGroupId));
    return;
  }
  browserStorage.set(recipePendingKey(familyGroupId), JSON.stringify(edits));
}
