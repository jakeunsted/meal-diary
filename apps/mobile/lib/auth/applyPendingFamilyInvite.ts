import {
  clearRegisterCode,
  getRegisterCode,
} from '@/lib/auth/registerStorage';
import {
  joinFamilyGroup,
  refreshUserAfterFamilyChange,
} from '@/lib/queries/family';
import type { User } from '@/types/api';

export async function applyPendingFamilyInvite(user: User): Promise<User> {
  if (user.family_group_id != null) {
    return user;
  }

  const code = await getRegisterCode();
  if (!code) {
    return user;
  }

  await joinFamilyGroup(code);
  const updatedUser = await refreshUserAfterFamilyChange(user.id);
  await clearRegisterCode();
  return updatedUser;
}
