import { beforeEach, describe, expect, it, vi } from 'vitest';

const { showError, handleAutoLogout, refreshTokens, openPaywall, authStore, isTokenExpired } = vi.hoisted(() => ({
  showError: vi.fn(),
  handleAutoLogout: vi.fn(),
  refreshTokens: vi.fn(),
  openPaywall: vi.fn(),
  isTokenExpired: vi.fn(() => false),
  authStore: {
    accessToken: 'access',
    refreshToken: 'refresh',
    user: { id: 1 } as { id: number } | null,
    setAuth: vi.fn(),
  },
}));

vi.mock('~/composables/useToast', () => ({
  useToast: () => ({ showError }),
}));

vi.mock('~/composables/useAuth', () => ({
  handleAutoLogout,
  useAuth: () => ({ refreshTokens }),
}));

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => authStore,
}));

vi.mock('~/composables/useJWT', () => ({
  isTokenExpired,
}));

vi.mock('~/composables/usePaywall', () => ({
  usePaywall: () => ({ openPaywall }),
}));

import { useApi } from './useApi';

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.accessToken = 'access';
    authStore.refreshToken = 'refresh';
    authStore.user = { id: 1 };
    isTokenExpired.mockReturnValue(false);
    vi.stubGlobal('$fetch', vi.fn());
    vi.stubGlobal('usePaywall', () => ({ openPaywall }));
  });

  it('sends the current tokens and stores tokens rotated by the server', async () => {
    vi.mocked(globalThis.$fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      headers: { 'x-new-access-token': 'next-access', 'x-new-refresh-token': 'next-refresh' },
    });

    const result = await useApi().api('/api/recipes', { method: 'GET' });

    expect(globalThis.$fetch).toHaveBeenCalledWith('/api/recipes', expect.objectContaining({
      headers: {
        Authorization: 'Bearer access',
        'x-refresh-token': 'refresh',
      },
    }));
    expect(authStore.setAuth).toHaveBeenCalledWith({
      user: authStore.user,
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
    });
    expect(result).toEqual(expect.objectContaining({ ok: true }));
  });

  it('refreshes an expired access token before the request', async () => {
    isTokenExpired.mockReturnValue(true);
    vi.mocked(globalThis.$fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ headers: {} });

    await useApi().api('/api/recipes');

    expect(refreshTokens).toHaveBeenCalled();
  });

  it('retries a rotated 401 and logs out when the session is actually expired', async () => {
    const fetchMock = vi.mocked(globalThis.$fetch as ReturnType<typeof vi.fn>);
    fetchMock
      .mockRejectedValueOnce({
        statusCode: 401,
        data: { message: 'token expired and refresh token was rotated' },
      })
      .mockResolvedValueOnce({ headers: {}, id: 2 });

    await expect(useApi().api('/api/recipes')).resolves.toEqual({ headers: {}, id: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockRejectedValueOnce({
      statusCode: 401,
      data: { message: 'invalid or expired refresh token' },
    });
    await expect(useApi().api('/api/recipes')).rejects.toEqual(expect.objectContaining({ statusCode: 401 }));
    expect(handleAutoLogout).toHaveBeenCalled();
  });

  it('opens the paywall, shows a toast, and rethrows aborts', async () => {
    const fetchMock = vi.mocked(globalThis.$fetch as ReturnType<typeof vi.fn>);
    globalThis.__NUXT_CLIENT__ = true;
    fetchMock.mockRejectedValueOnce({
      statusCode: 403,
      data: { code: 'ENTITLEMENT_REQUIRED', feature: 'recipes', message: 'Upgrade required' },
    });
    await expect(useApi().api('/api/recipes')).rejects.toBeTruthy();
    expect(openPaywall).toHaveBeenCalledWith('recipes');

    fetchMock.mockRejectedValueOnce({ statusCode: 500, data: { message: 'Boom' } });
    await expect(useApi().api('/api/recipes')).rejects.toBeTruthy();
    expect(showError).toHaveBeenCalledWith('Boom');

    fetchMock.mockRejectedValueOnce({ statusCode: 500, data: { message: 'Quiet' } });
    await expect(useApi().api('/api/recipes', { silent: true })).rejects.toBeTruthy();
    expect(showError).toHaveBeenCalledTimes(1);

    const abort = Object.assign(new Error('stopped'), { name: 'AbortError' });
    fetchMock.mockRejectedValueOnce(abort);
    await expect(useApi().api('/api/recipes')).rejects.toBe(abort);
    expect(showError).toHaveBeenCalledTimes(1);
  });
});
