import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { Recipe } from '@/types/recipe';

const FAMILY_RECIPES_STALE_MS = 5 * 60 * 1000;

export const recipeKeys = {
  all: ['recipes'] as const,
  family: (familyGroupId: number) => ['recipes', familyGroupId] as const,
};

export async function fetchFamilyRecipes(
  familyGroupId: number,
  search?: string
): Promise<Recipe[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<Recipe[]>(`/recipes/family/${familyGroupId}${query}`);
}

export function useFamilyRecipes(
  familyGroupId: number | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: recipeKeys.family(familyGroupId ?? 0),
    queryFn: () => fetchFamilyRecipes(familyGroupId!),
    enabled: !!familyGroupId && (options?.enabled ?? true),
    staleTime: FAMILY_RECIPES_STALE_MS,
  });
}
