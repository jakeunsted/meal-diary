import { describe, expect, it, vi } from 'vitest';
import { resolveFamilyStreamAccess, userIdFromAuthorization } from './familyStreamAuth';

const bearerFor = (userId: number): string => {
  const payload = Buffer.from(JSON.stringify({ userId })).toString('base64url');
  return `Bearer h.${payload}.s`;
};

describe('family stream access', () => {
  it('reads a positive user id from a bearer token', () => {
    expect(userIdFromAuthorization(bearerFor(12))).toBe(12);
    expect(userIdFromAuthorization(undefined)).toBeNull();
    expect(userIdFromAuthorization('Bearer not-a-jwt')).toBeNull();
  });

  it('allows only the member of the requested family', async () => {
    const fetchUser = vi.fn().mockResolvedValue({ family_group_id: 9 });
    await expect(resolveFamilyStreamAccess(bearerFor(4), 9, fetchUser)).resolves.toBe('ok');
    await expect(resolveFamilyStreamAccess(bearerFor(4), 3, fetchUser)).resolves.toBe('forbidden');
    await expect(resolveFamilyStreamAccess(undefined, 9, fetchUser)).resolves.toBe('unauthorized');
  });

  it('maps API auth failures and still throws when the API cannot be reached', async () => {
    const denied = vi.fn().mockRejectedValue({ statusCode: 401 });
    await expect(resolveFamilyStreamAccess(bearerFor(4), 9, denied)).resolves.toBe('unauthorized');

    const down = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(resolveFamilyStreamAccess(bearerFor(4), 9, down)).rejects.toThrow('offline');
  });
});
