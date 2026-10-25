export type FamilyStreamDecision = 'ok' | 'unauthorized' | 'forbidden';

interface StreamUser {
  family_group_id?: number | null;
}

/**
 * Read the user id from a bearer JWT without trusting the signature.
 * The API still verifies the token when the user is loaded.
 */
export const userIdFromAuthorization = (authorization: string | undefined): number | null => {
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = authorization.slice(authorization.indexOf(' ') + 1).trim();
  const payload = token.split('.')[1];
  if (!payload) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { userId?: unknown };
    const userId = Number(decoded.userId);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
};

export const resolveFamilyStreamAccess = async (
  authorization: string | undefined,
  familyGroupId: number,
  fetchUser: (userId: number) => Promise<StreamUser>
): Promise<FamilyStreamDecision> => {
  const userId = userIdFromAuthorization(authorization);
  if (!authorization || userId === null || !Number.isInteger(familyGroupId)) {
    return 'unauthorized';
  }

  try {
    const user = await fetchUser(userId);
    return Number(user.family_group_id) === familyGroupId ? 'ok' : 'forbidden';
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 401) {
      return 'unauthorized';
    }
    if (statusCode === 403 || statusCode === 404) {
      return 'forbidden';
    }
    throw error;
  }
};
