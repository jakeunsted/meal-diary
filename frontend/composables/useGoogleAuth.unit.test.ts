import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api, authStore, router, reportAuthError, socialLogin, isNative } = vi.hoisted(() => ({
  api: vi.fn(),
  authStore: { setAuth: vi.fn() },
  router: { push: vi.fn() },
  reportAuthError: vi.fn(),
  socialLogin: { initialize: vi.fn(), login: vi.fn() },
  isNative: vi.fn(() => false),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNative() },
}));

vi.mock('@capgo/capacitor-social-login', () => ({
  SocialLogin: socialLogin,
}));

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => authStore,
}));

vi.mock('~/composables/useApi', () => ({
  useApi: () => ({ api }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => router,
}));

vi.mock('~/composables/useAuthAnalytics', () => ({
  useAuthAnalytics: () => ({ reportAuthError }),
}));

import { useGoogleAuth } from './useGoogleAuth';

describe('useGoogleAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNative.mockReturnValue(false);
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { googleClientId: 'google-client' } }));
    vi.stubGlobal('useAuthAnalytics', () => ({ reportAuthError }));
    vi.stubGlobal('window', { location: { href: '' } });
  });

  it('sends the browser to the web OAuth route', async () => {
    await useGoogleAuth().signInWithGoogle();
    expect(window.location.href).toBe('/api/auth/google');
  });

  it('verifies a native ID token and opens the diary', async () => {
    isNative.mockReturnValue(true);
    socialLogin.login.mockResolvedValue({
      provider: 'google',
      result: { idToken: 'google-token' },
    });
    api.mockResolvedValue({
      user: { id: 4, family_group_id: 2 },
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    await useGoogleAuth().signInWithGoogle();

    expect(socialLogin.initialize).toHaveBeenCalled();
    expect(api).toHaveBeenCalledWith('/api/auth/google/verify-token', expect.objectContaining({
      method: 'POST',
      body: { idToken: 'google-token' },
    }));
    expect(router.push).toHaveBeenCalledWith('/diary');
  });

  it('reports a native failure when Google returns no token', async () => {
    isNative.mockReturnValue(true);
    socialLogin.login.mockResolvedValue({
      provider: 'google',
      result: {},
    });

    const auth = useGoogleAuth();
    await expect(auth.signInWithGoogle()).rejects.toThrow('No ID token received from Google');
    expect(auth.error.value).toBe('No ID token received from Google');
    expect(reportAuthError).toHaveBeenCalledWith('google_auth_client_error', expect.objectContaining({
      flow: 'native_google_token',
    }));
  });
});
