import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api, authStore, router, signIn } = vi.hoisted(() => ({
  api: vi.fn(),
  authStore: { setAuth: vi.fn() },
  router: { push: vi.fn() },
  signIn: vi.fn(),
}));

vi.mock('~/utils/appleSignIn', async () => {
  const actual = await vi.importActual<typeof import('~/utils/appleSignIn')>('~/utils/appleSignIn');
  return {
    ...actual,
    signInWithApplePopup: (...args: unknown[]) => signIn(...args),
  };
});

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => authStore,
}));

vi.mock('~/composables/useApi', () => ({
  useApi: () => ({ api }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => router,
}));

import { useAppleAuth } from './useAppleAuth';

describe('useAppleAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { appleServicesId: 'com.mealdiary.web' },
    }));
  });

  it('is hidden until a services id is configured', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: {} }));
    expect(useAppleAuth().isConfigured.value).toBe(false);
  });

  it('stores the session and sends a new family to registration', async () => {
    signIn.mockResolvedValue({
      idToken: 'apple-token',
      rawNonce: 'nonce',
      givenName: 'Ada',
      familyName: '',
    });
    api.mockResolvedValue({
      user: { id: 4, family_group_id: null },
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    const result = await useAppleAuth().signInWithApple();

    expect(result).toBe('success');
    expect(api).toHaveBeenCalledWith('/api/auth/apple/verify-token', expect.objectContaining({
      body: { idToken: 'apple-token', nonce: 'nonce', givenName: 'Ada' },
    }));
    expect(router.push).toHaveBeenCalledWith('/registration/step-2');
  });

  it('treats a closed popup as a cancellation', async () => {
    signIn.mockRejectedValue({ error: 'popup_closed_by_user' });
    await expect(useAppleAuth().signInWithApple()).resolves.toBe('cancelled');
  });
});
