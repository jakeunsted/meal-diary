import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import type {
  DisplayMember,
  FamilyGroup,
  FamilyMember,
  ResolvedEntitlements,
  User,
} from '@/types/api';

export function useCurrentUser() {
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  return useQuery({
    queryKey: ['user', authUser?.id],
    queryFn: async () => {
      const user = await apiFetch<User>(`/users/${authUser!.id}`);
      setUser(user);
      return user;
    },
    enabled: !!authUser?.id,
    initialData: authUser ?? undefined,
  });
}

export function useFamilyGroup(familyGroupId: number | undefined) {
  return useQuery({
    queryKey: ['familyGroup', familyGroupId],
    queryFn: () => apiFetch<FamilyGroup>(`/family-groups/${familyGroupId}`),
    enabled: !!familyGroupId,
  });
}

export function useFamilyMembers(familyGroupId: number | undefined) {
  const currentUserId = useAuthStore((state) => state.user?.id);

  return useQuery({
    queryKey: ['familyMembers', familyGroupId],
    queryFn: () => apiFetch<FamilyMember[]>(`/family-groups/${familyGroupId}/members`),
    enabled: !!familyGroupId,
    select: (members): DisplayMember[] =>
      members
        .filter((member) => member.id !== currentUserId)
        .map((member) => ({
          id: member.id,
          name: member.username,
          avatar_url: member.avatar_url,
        })),
  });
}

export const entitlementKeys = {
  all: ['entitlements'] as const,
  family: (familyGroupId: number) => ['entitlements', familyGroupId] as const,
};

export async function fetchEntitlements(familyGroupId: number): Promise<ResolvedEntitlements> {
  const entitlements = await apiFetch<ResolvedEntitlements>(
    `/family-groups/${familyGroupId}/entitlements`
  );
  await useAuthStore.getState().setEntitlements(entitlements);
  return entitlements;
}

export function useEntitlements(familyGroupId: number | undefined) {
  const placeholderEntitlements = useAuthStore((state) => state.entitlements);

  return useQuery({
    queryKey: familyGroupId ? entitlementKeys.family(familyGroupId) : entitlementKeys.all,
    queryFn: () => fetchEntitlements(familyGroupId as number),
    enabled: !!familyGroupId,
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: placeholderEntitlements ?? undefined,
  });
}
