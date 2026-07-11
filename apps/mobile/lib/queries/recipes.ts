import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type {
  CreateRecipePayload,
  Recipe,
  UpdateRecipePayload,
} from '@/types/recipe';

const FAMILY_RECIPES_STALE_MS = 5 * 60 * 1000;

export const recipeKeys = {
  all: ['recipes'] as const,
  family: (familyGroupId: number) => ['recipes', familyGroupId] as const,
  detail: (recipeId: number) => ['recipes', 'detail', recipeId] as const,
};

export const entitlementKeys = {
  family: (familyGroupId: number) => ['entitlements', familyGroupId] as const,
};

export async function fetchFamilyRecipes(
  familyGroupId: number,
  search?: string
): Promise<Recipe[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<Recipe[]>(`/recipes/family/${familyGroupId}${query}`);
}

export async function fetchRecipe(recipeId: number): Promise<Recipe> {
  return apiFetch<Recipe>(`/recipes/${recipeId}`);
}

export async function createRecipe(
  familyGroupId: number,
  payload: CreateRecipePayload
): Promise<Recipe> {
  return apiFetch<Recipe>('/recipes', {
    method: 'POST',
    body: {
      family_group_id: familyGroupId,
      ...payload,
    },
  });
}

export async function updateRecipe(
  recipeId: number,
  payload: UpdateRecipePayload
): Promise<Recipe> {
  return apiFetch<Recipe>(`/recipes/${recipeId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteRecipe(recipeId: number): Promise<void> {
  await apiFetch<void>(`/recipes/${recipeId}`, {
    method: 'DELETE',
  });
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

export function useRecipe(recipeId: number | undefined) {
  return useQuery({
    queryKey: recipeKeys.detail(recipeId ?? 0),
    queryFn: () => fetchRecipe(recipeId!),
    enabled: !!recipeId,
    staleTime: FAMILY_RECIPES_STALE_MS,
  });
}

function invalidateRecipeQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  familyGroupId: number,
  recipeId?: number
): void {
  void queryClient.invalidateQueries({ queryKey: recipeKeys.family(familyGroupId) });
  void queryClient.invalidateQueries({ queryKey: entitlementKeys.family(familyGroupId) });

  if (recipeId != null) {
    void queryClient.invalidateQueries({ queryKey: recipeKeys.detail(recipeId) });
  }
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      familyGroupId,
      payload,
    }: {
      familyGroupId: number;
      payload: CreateRecipePayload;
    }) => createRecipe(familyGroupId, payload),
    onSuccess: (recipe, { familyGroupId }) => {
      queryClient.setQueryData(recipeKeys.detail(recipe.id), recipe);
      invalidateRecipeQueries(queryClient, familyGroupId);
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      payload,
    }: {
      recipeId: number;
      familyGroupId: number;
      payload: UpdateRecipePayload;
    }) => updateRecipe(recipeId, payload),
    onSuccess: (recipe, { familyGroupId, recipeId }) => {
      queryClient.setQueryData(recipeKeys.detail(recipeId), recipe);
      invalidateRecipeQueries(queryClient, familyGroupId, recipeId);
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
    }: {
      recipeId: number;
      familyGroupId: number;
    }) => deleteRecipe(recipeId),
    onSuccess: (_result, { familyGroupId, recipeId }) => {
      queryClient.removeQueries({ queryKey: recipeKeys.detail(recipeId) });
      invalidateRecipeQueries(queryClient, familyGroupId);
    },
  });
}
