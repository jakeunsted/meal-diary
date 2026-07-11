import type { User } from '@/types/api';

export function hasFamilyGroup(user: User | null | undefined): boolean {
  return user?.family_group_id != null;
}

export function getPostAuthRoute(user: User | null | undefined): '/(tabs)/diary' | '/(auth)/registration/step-2' {
  return hasFamilyGroup(user) ? '/(tabs)/diary' : '/(auth)/registration/step-2';
}
