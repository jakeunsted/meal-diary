import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { MealSlotTemplate } from '@/types/mealDiary';

export const mealSlotsKeys = {
  all: ['mealSlots'] as const,
  family: (familyGroupId: number) => ['mealSlots', familyGroupId] as const,
};

export async function fetchMealSlots(familyGroupId: number): Promise<MealSlotTemplate[]> {
  const response = await apiFetch<{ slots: MealSlotTemplate[] }>(
    `/family-groups/${familyGroupId}/meal-slots`
  );
  return response.slots ?? [];
}

export async function updateMealSlots(
  familyGroupId: number,
  body: {
    slots: Array<{ id?: number | null; name: string }>;
    today: string;
    confirm?: boolean;
  }
): Promise<MealSlotTemplate[]> {
  const response = await apiFetch<{ slots: MealSlotTemplate[] }>(
    `/family-groups/${familyGroupId}/meal-slots`,
    {
      method: 'PUT',
      body,
    }
  );
  return response.slots ?? [];
}

export function useMealSlots(familyGroupId: number | undefined) {
  return useQuery({
    queryKey: mealSlotsKeys.family(familyGroupId ?? 0),
    queryFn: () => fetchMealSlots(familyGroupId!),
    enabled: Boolean(familyGroupId),
  });
}

export function useUpdateMealSlots(familyGroupId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      slots: Array<{ id?: number | null; name: string }>;
      today: string;
      confirm?: boolean;
    }) => updateMealSlots(familyGroupId!, body),
    onSuccess: (slots) => {
      if (!familyGroupId) return;
      queryClient.setQueryData(mealSlotsKeys.family(familyGroupId), slots);
    },
  });
}
