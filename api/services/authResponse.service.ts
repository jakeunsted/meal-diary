import type { UserAttributes } from '../db/models/User.model.ts';
import type User from '../db/models/User.model.ts';
import { sanitizeUser } from './user.service.ts';
import { resolveEntitlements } from './entitlements.service.ts';
import type { ResolvedEntitlements } from './entitlements.service.ts';
import type { SanitizedUser } from './user.service.ts';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponsePayload {
  user: SanitizedUser;
  accessToken: string;
  refreshToken: string;
  entitlements?: ResolvedEntitlements;
}

export const buildAuthResponse = async (
  user: User & UserAttributes,
  tokens: AuthTokens
): Promise<AuthResponsePayload> => {
  const sanitizedUser = sanitizeUser(user);
  const payload: AuthResponsePayload = {
    user: sanitizedUser,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };

  if (sanitizedUser.family_group_id) {
    payload.entitlements = await resolveEntitlements(
      sanitizedUser.family_group_id,
      sanitizedUser.id
    );
  }

  return payload;
};
