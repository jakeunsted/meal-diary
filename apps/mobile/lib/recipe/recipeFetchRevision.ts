const detailRevisions = new Map<number, number>();
const listRevisions = new Map<number, number>();

export function readRecipeDetailRevision(recipeId: number): number {
  return detailRevisions.get(recipeId) ?? 0;
}

export function readRecipeListRevision(familyGroupId: number): number {
  return listRevisions.get(familyGroupId) ?? 0;
}

export function bumpRecipeDetailRevision(recipeId: number): void {
  detailRevisions.set(recipeId, readRecipeDetailRevision(recipeId) + 1);
}

export function bumpRecipeListRevision(familyGroupId: number): void {
  listRevisions.set(familyGroupId, readRecipeListRevision(familyGroupId) + 1);
}

export function bumpRecipeFetches(familyGroupId: number, recipeId: number): void {
  bumpRecipeDetailRevision(recipeId);
  bumpRecipeListRevision(familyGroupId);
}

export function resetRecipeFetchRevisions(): void {
  detailRevisions.clear();
  listRevisions.clear();
}
