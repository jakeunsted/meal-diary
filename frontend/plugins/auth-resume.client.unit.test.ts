import { describe, expect, it, vi } from 'vitest';

const { refreshTokens, handleAutoLogout, isTokenExpired, authStore } = vi.hoisted(() => ({
  refreshTokens: vi.fn(),
  handleAutoLogout: vi.fn(),
  isTokenExpired: vi.fn(() => true),
  authStore: {
    accessToken: 'access',
    refreshToken: 'refresh',
  },
}));

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => authStore,
}));

vi.mock('~/composables/useAuth', () => ({
  useAuth: () => ({ refreshTokens }),
  handleAutoLogout,
}));

vi.mock('~/composables/useJWT', () => ({
  isTokenExpired,
}));

import plugin from './auth-resume.client';

describe('auth-resume plugin', () => {
  it('refreshes an expired token when the app becomes visible', async () => {
    const listeners = new Map<string, (event?: Event) => void>();
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: (type: string, listener: (event?: Event) => void) => listeners.set(type, listener),
    });
    vi.stubGlobal('window', {
      addEventListener: (type: string, listener: (event?: Event) => void) => listeners.set(`window:${type}`, listener),
    });
    globalThis.__NUXT_CLIENT__ = true;

    plugin();
    await listeners.get('visibilitychange')?.();
    expect(refreshTokens).toHaveBeenCalled();

    document.visibilityState = 'hidden';
    refreshTokens.mockClear();
    await listeners.get('visibilitychange')?.();
    expect(refreshTokens).not.toHaveBeenCalled();

    refreshTokens.mockRejectedValueOnce(new Error('invalid or expired refresh token'));
    document.visibilityState = 'visible';
    listeners.get('window:pageshow')?.({ persisted: true } as PageTransitionEvent);
    await vi.waitFor(() => expect(handleAutoLogout).toHaveBeenCalled());
  });
});
