import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { recipeKeys } from '@/lib/queries/recipes';
import type { RecipeCategory } from '@/types/recipe';

export const recipeCategoryKeys = {
  all: ['recipeCategories'] as const,
  family: (familyGroupId: number) => ['recipeCategories', familyGroupId] as const,
};

export async function fetchRecipeCategories(familyGroupId: number): Promise<RecipeCategory[]> {
  const response = await apiFetch<{ categories: RecipeCategory[] }>(
    `/family-groups/${familyGroupId}/recipe-categories`
  );
  return response.categories ?? [];
}

export async function createRecipeCategory(
  familyGroupId: number,
  name: string
): Promise<RecipeCategory> {
  const response = await apiFetch<{ category: RecipeCategory }>(
    `/family-groups/${familyGroupId}/recipe-categories`,
    {
      method: 'POST',
      body: { name },
    }
  );
  return response.category;
}

export async function renameRecipeCategory(
  familyGroupId: number,
  categoryId: number,
  name: string
): Promise<RecipeCategory> {
  const response = await apiFetch<{ category: RecipeCategory }>(
    `/family-groups/${familyGroupId}/recipe-categories/${categoryId}`,
    {
      method: 'PATCH',
      body: { name },
    }
  );
  return response.category;
}

export async function deleteRecipeCategory(
  familyGroupId: number,
  categoryId: number
): Promise<void> {
  await apiFetch<void>(`/family-groups/${familyGroupId}/recipe-categories/${categoryId}`, {
    method: 'DELETE',
  });
}

export function useRecipeCategories(familyGroupId: number | undefined) {
  return useQuery({
    queryKey: recipeCategoryKeys.family(familyGroupId ?? 0),
    queryFn: () => fetchRecipeCategories(familyGroupId!),
    enabled: Boolean(familyGroupId),
  });
}

function invalidateRecipeCategoryQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  familyGroupId: number
): void {
  void queryClient.invalidateQueries({ queryKey: recipeCategoryKeys.family(familyGroupId) });
  void queryClient.invalidateQueries({ queryKey: recipeKeys.all });
}

function useRecipeCategoryMutation<TVariables>(
  familyGroupId: number | undefined,
  mutationFn: (variables: TVariables) => Promise<unknown>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      if (familyGroupId) {
        invalidateRecipeCategoryQueries(queryClient, familyGroupId);
      }
    },
  });
}

export function useCreateRecipeCategory(familyGroupId: number | undefined) {
  return useRecipeCategoryMutation(familyGroupId, (name: string) =>
    createRecipeCategory(familyGroupId!, name)
  );
}

export function useRenameRecipeCategory(familyGroupId: number | undefined) {
  return useRecipeCategoryMutation(
    familyGroupId,
    ({ categoryId, name }: { categoryId: number; name: string }) =>
      renameRecipeCategory(familyGroupId!, categoryId, name)
  );
}

export function useDeleteRecipeCategory(familyGroupId: number | undefined) {
  return useRecipeCategoryMutation(familyGroupId, (categoryId: number) =>
    deleteRecipeCategory(familyGroupId!, categoryId)
  );
}
