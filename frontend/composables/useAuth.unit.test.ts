import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api, authStore, router } = vi.hoisted(() => ({
  api: vi.fn(),
  router: { push: vi.fn() },
  authStore: {
    accessToken: 'access',
    refreshToken: 'refresh',
    user: { id: 1, email: 'ada@example.com' } as { id: number; email: string } | null,
    isAuthenticated: true,
    setAuth: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('~/composables/useApi', () => ({
  useApi: () => ({ api }),
}));

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => authStore,
}));

vi.mock('vue-router', () => ({
  useRouter: () => router,
}));

import { handleAutoLogout, hasFamilyGroup, useAuth } from './useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.accessToken = 'access';
    authStore.refreshToken = 'refresh';
    authStore.user = { id: 1, email: 'ada@example.com' };
    vi.stubGlobal('localStorage', { removeItem: vi.fn() });
    vi.stubGlobal('$fetch', vi.fn());
  });

  it('detects a family group and chooses the login redirect', async () => {
    expect(hasFamilyGroup(null)).toBe(false);
    expect(hasFamilyGroup({ family_group_id: undefined })).toBe(false);
    expect(hasFamilyGroup({ family_group_id: 4 })).toBe(true);

    api.mockResolvedValueOnce({
      user: { id: 1, family_group_id: null },
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    const auth = useAuth();
    const joined = await auth.login('ada@example.com', 'Password1!');
    expect(joined.redirect).toBe('/registration/step-2');

    api.mockResolvedValueOnce({
      user: { id: 1, family_group_id: 4 },
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    const home = await auth.login('ada@example.com', 'Password1!');
    expect(home.redirect).toBe('/diary');
    expect(authStore.setAuth).toHaveBeenCalled();
  });

  it('records a login failure and logs out through the API', async () => {
    api.mockRejectedValueOnce({ data: { message: 'Invalid credentials' } });
    const auth = useAuth();
    await expect(auth.login('ada@example.com', 'nope')).rejects.toEqual({ data: { message: 'Invalid credentials' } });
    expect(auth.error.value).toBe('Invalid credentials');

    api.mockResolvedValueOnce({});
    await auth.logout();
    expect(api).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
    expect(authStore.logout).toHaveBeenCalled();
  });

  it('refreshes tokens and keeps the current session when another caller already rotated them', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const body = Buffer.from(JSON.stringify({ exp: future })).toString('base64url');
    authStore.accessToken = `h.${body}.s`;
    vi.mocked(globalThis.$fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
    });

    const refreshed = await useAuth().refreshTokens();
    expect(refreshed.accessToken).toBe('next-access');
    expect(authStore.setAuth).toHaveBeenCalled();

    vi.mocked(globalThis.$fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      statusCode: 403,
      data: { message: 'forbidden' },
    });
    const kept = await useAuth().refreshTokens();
    expect(kept.accessToken).toBe(authStore.accessToken);
  });

  it('sends the user to login on the client during an automatic logout', async () => {
    globalThis.__NUXT_CLIENT__ = true;
    await handleAutoLogout();
    expect(authStore.logout).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/login');
  });
});
