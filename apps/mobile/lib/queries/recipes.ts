import { OFFLINE_REQUEST_TIMEOUT_MS, overlayRecipe, replaceById, resolveStaleFetch } from '@meal-diary/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { apiFetch } from '@/lib/api/client';
import { retryUnlessOffline } from '@/lib/queries/mealDiary';
import { entitlementKeys } from '@/lib/queries/profile';
import { overlayRecipeList } from '@/lib/recipe/overlayRecipe';
import {
  bumpRecipeFetches,
  readRecipeDetailRevision,
  readRecipeListRevision,
} from '@/lib/recipe/recipeFetchRevision';
import { loadRecipePendingQueue } from '@/lib/recipe/recipePendingQueue';
import {
  loadCachedRecipe,
  loadFamilyRecipesCache,
  saveFamilyRecipesCache,
} from '@/lib/recipe/recipeStorage';
import type {
  CreateRecipePayload,
  ImportRecipeFromUrlPayload,
  Recipe,
  UpdateRecipePayload,
} from '@/types/recipe';

const FAMILY_RECIPES_STALE_MS = 5 * 60 * 1000;

export const recipeKeys = {
  all: ['recipes'] as const,
  family: (familyGroupId: number) => ['recipes', familyGroupId] as const,
  detail: (recipeId: number) => ['recipes', 'detail', recipeId] as const,
};

export async function fetchFamilyRecipes(
  familyGroupId: number,
  search?: string
): Promise<Recipe[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<Recipe[]>(`/recipes/family/${familyGroupId}${query}`, {
    timeoutMs: OFFLINE_REQUEST_TIMEOUT_MS,
  });
}

export async function fetchRecipe(recipeId: number): Promise<Recipe> {
  return apiFetch<Recipe>(`/recipes/${recipeId}`, {
    timeoutMs: OFFLINE_REQUEST_TIMEOUT_MS,
  });
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
    timeoutMs: OFFLINE_REQUEST_TIMEOUT_MS,
  });
}

export async function importRecipeFromUrl(
  familyGroupId: number,
  payload: ImportRecipeFromUrlPayload
): Promise<Recipe> {
  return apiFetch<Recipe>('/recipes/import-from-url', {
    method: 'POST',
    body: {
      family_group_id: familyGroupId,
      url: payload.url,
    },
    timeoutMs: OFFLINE_REQUEST_TIMEOUT_MS,
  });
}

export async function updateRecipe(
  recipeId: number,
  payload: UpdateRecipePayload
): Promise<Recipe> {
  return apiFetch<Recipe>(`/recipes/${recipeId}`, {
    method: 'PUT',
    body: payload,
    timeoutMs: OFFLINE_REQUEST_TIMEOUT_MS,
  });
}

export async function deleteRecipe(recipeId: number): Promise<void> {
  await apiFetch<void>(`/recipes/${recipeId}`, {
    method: 'DELETE',
  });
}

function recipeFromFamilyCaches(queryClient: QueryClient, recipeId: number): Recipe | undefined {
  const lists = queryClient.getQueriesData<Recipe[]>({ queryKey: recipeKeys.all });
  for (const [, data] of lists) {
    if (!Array.isArray(data)) {
      continue;
    }
    const match = data.find((recipe) => recipe.id === recipeId);
    if (match) {
      return match;
    }
  }
  return undefined;
}

async function fetchFamilyRecipesWithCache(
  queryClient: QueryClient,
  familyGroupId: number
): Promise<Recipe[]> {
  const revision = readRecipeListRevision(familyGroupId);
  const fetched = await fetchFamilyRecipes(familyGroupId);
  const current = queryClient.getQueryData<Recipe[]>(recipeKeys.family(familyGroupId));
  const resolved = resolveStaleFetch(
    revision,
    readRecipeListRevision(familyGroupId),
    current,
    fetched
  );
  if (resolved !== fetched) {
    return resolved;
  }
  await saveFamilyRecipesCache(familyGroupId, fetched);
  const pending = await loadRecipePendingQueue(familyGroupId);
  return overlayRecipeList(fetched, pending);
}

async function fetchRecipeWithCache(
  queryClient: QueryClient,
  recipeId: number
): Promise<Recipe> {
  const revision = readRecipeDetailRevision(recipeId);
  const fetched = await fetchRecipe(recipeId);
  const current = queryClient.getQueryData<Recipe>(recipeKeys.detail(recipeId));
  const resolved = resolveStaleFetch(
    revision,
    readRecipeDetailRevision(recipeId),
    current,
    fetched
  );
  if (resolved !== fetched) {
    return resolved;
  }
  const cached = await loadFamilyRecipesCache(fetched.family_group_id);
  if (cached) {
    await saveFamilyRecipesCache(fetched.family_group_id, replaceById(cached, fetched));
  }
  const pending = await loadRecipePendingQueue(fetched.family_group_id);
  const edit = pending.find((item) => item.recipeId === fetched.id);
  return edit ? overlayRecipe(fetched, edit.recipe) : fetched;
}

export function useFamilyRecipes(
  familyGroupId: number | undefined,
  options?: { enabled?: boolean }
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!familyGroupId) {
      return;
    }
    const queryKey = recipeKeys.family(familyGroupId);
    if (queryClient.getQueryData(queryKey)) {
      return;
    }
    void (async () => {
      const cached = await loadFamilyRecipesCache(familyGroupId);
      if (!cached) {
        return;
      }
      const pending = await loadRecipePendingQueue(familyGroupId);
      if (queryClient.getQueryData(queryKey)) {
        return;
      }
      queryClient.setQueryData(queryKey, overlayRecipeList(cached, pending));
    })();
  }, [familyGroupId, queryClient]);

  return useQuery({
    queryKey: recipeKeys.family(familyGroupId ?? 0),
    queryFn: () => fetchFamilyRecipesWithCache(queryClient, familyGroupId!),
    enabled: !!familyGroupId && (options?.enabled ?? true),
    staleTime: FAMILY_RECIPES_STALE_MS,
    retry: retryUnlessOffline,
  });
}

export function useRecipe(recipeId: number | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!recipeId) {
      return;
    }
    const queryKey = recipeKeys.detail(recipeId);
    if (queryClient.getQueryData(queryKey)) {
      return;
    }
    void (async () => {
      const known = recipeFromFamilyCaches(queryClient, recipeId) ?? await loadCachedRecipe(recipeId);
      if (!known || queryClient.getQueryData(queryKey)) {
        return;
      }
      const pending = await loadRecipePendingQueue(known.family_group_id);
      const edit = pending.find((item) => item.recipeId === known.id);
      queryClient.setQueryData(queryKey, edit ? overlayRecipe(known, edit.recipe) : known);
    })();
  }, [queryClient, recipeId]);

  return useQuery({
    queryKey: recipeKeys.detail(recipeId ?? 0),
    queryFn: () => fetchRecipeWithCache(queryClient, recipeId!),
    enabled: !!recipeId,
    staleTime: FAMILY_RECIPES_STALE_MS,
    retry: retryUnlessOffline,
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

export function useImportRecipeFromUrl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      familyGroupId,
      payload,
    }: {
      familyGroupId: number;
      payload: ImportRecipeFromUrlPayload;
    }) => importRecipeFromUrl(familyGroupId, payload),
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
      bumpRecipeFetches(familyGroupId, recipeId);
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
