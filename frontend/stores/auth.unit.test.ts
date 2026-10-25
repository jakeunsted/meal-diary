import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { User } from '../types/User';

const storageListeners: Array<(event: StorageEvent) => void> = [];

vi.mock('~/utils/browserStorage', () => ({
  browserStorage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.stubGlobal('window', {
  addEventListener: (type: string, listener: (event: StorageEvent) => void) => {
    if (type === 'storage') {
      storageListeners.push(listener);
    }
  },
});

import { useAuthStore } from './auth';
import { browserStorage } from '~/utils/browserStorage';

const futureToken = (): string => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `h.${payload}.s`;
};

const user = { id: 7, email: 'ada@example.com' } as User;

describe('auth store session sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    globalThis.__NUXT_CLIENT__ = true;
    vi.mocked(browserStorage.set).mockClear();
    useAuthStore();
  });

  it('ignores session tokens delivered on the family channel', async () => {
    const store = useAuthStore();
    store.user = user;
    store.accessToken = 'current-access';
    store.refreshToken = 'current-refresh';

    await store.updateTokensFromSSE({
      accessToken: futureToken(),
      refreshToken: futureToken(),
      userId: 7,
    });

    expect(store.accessToken).toBe('current-access');
    expect(store.refreshToken).toBe('current-refresh');
    expect(browserStorage.set).not.toHaveBeenCalled();
  });

  it('applies a refresh written by another tab and does not write storage again', () => {
    const store = useAuthStore();
    store.user = user;
    store.accessToken = 'current-access';
    store.refreshToken = 'current-refresh';

    const nextAccess = futureToken();
    const nextRefresh = futureToken();
    const raw = JSON.stringify({
      user,
      accessToken: nextAccess,
      refreshToken: nextRefresh,
      isAuthenticated: true,
    });

    for (const listener of storageListeners) {
      listener({ key: 'authState', newValue: raw } as StorageEvent);
    }

    expect(store.accessToken).toBe(nextAccess);
    expect(store.refreshToken).toBe(nextRefresh);
    expect(store.user?.id).toBe(7);
    expect(browserStorage.set).not.toHaveBeenCalled();
  });

  it('drops the in-memory session when another tab clears it', () => {
    const store = useAuthStore();
    store.user = user;
    store.accessToken = 'current-access';
    store.refreshToken = 'current-refresh';

    for (const listener of storageListeners) {
      listener({ key: 'authState', newValue: null } as StorageEvent);
    }

    expect(store.accessToken).toBeNull();
    expect(store.refreshToken).toBeNull();
    expect(store.user).toBeNull();
  });
});
