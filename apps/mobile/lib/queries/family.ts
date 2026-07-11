import { apiFetch } from '@/lib/api/client';
import { queryClient } from '@/lib/api/queryClient';
import { useAuthStore } from '@/lib/auth/authStore';
import { getAuthState, setAuthState } from '@/lib/auth/tokenStorage';
import type { FamilyGroup, User } from '@/types/api';

export async function createFamilyGroup(name: string): Promise<FamilyGroup> {
  return apiFetch<FamilyGroup>('/family-groups', {
    method: 'POST',
    body: { name },
  });
}

export async function joinFamilyGroup(randomIdentifier: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/family-groups/join', {
    method: 'POST',
    body: { random_identifier: randomIdentifier },
  });
}

export async function leaveFamilyGroup(familyGroupId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/family-groups/${familyGroupId}/leave`, {
    method: 'POST',
  });
}

export async function transferFamilyOwnership(
  familyGroupId: number,
  newOwnerId: number
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/family-groups/${familyGroupId}/transfer-ownership`, {
    method: 'POST',
    body: { new_owner_id: newOwnerId },
  });
}

export async function deleteFamilyGroup(familyGroupId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/family-groups/${familyGroupId}`, {
    method: 'DELETE',
  });
}

export interface RegisterUserPayload {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  terms_accepted: boolean;
  family_group_code?: string;
}

export async function registerUser(payload: RegisterUserPayload): Promise<User> {
  return apiFetch<User>('/users', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export async function fetchUserById(userId: number): Promise<User> {
  return apiFetch<User>(`/users/${userId}`);
}

export async function refreshUserAfterFamilyChange(userId: number): Promise<User> {
  const user = await fetchUserById(userId);
  const stored = await getAuthState();
  if (stored) {
    await setAuthState({ ...stored, user });
  }
  useAuthStore.getState().setUser(user);
  await queryClient.invalidateQueries({ queryKey: ['user', userId] });
  await queryClient.invalidateQueries({ queryKey: ['familyGroup'] });
  await queryClient.invalidateQueries({ queryKey: ['familyMembers'] });
  await queryClient.invalidateQueries({ queryKey: ['entitlements'] });
  return user;
}

export async function clearFamilyQueries(): Promise<void> {
  await queryClient.removeQueries({ queryKey: ['familyGroup'] });
  await queryClient.removeQueries({ queryKey: ['familyMembers'] });
  await queryClient.removeQueries({ queryKey: ['entitlements'] });
}
