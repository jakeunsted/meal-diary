import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGoogleAuth } from './useGoogleAuth';

describe('useGoogleAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { href: '' } });
  });

  it('sends the browser to the web OAuth route', async () => {
    const auth = useGoogleAuth();
    await auth.signInWithGoogle();
    expect(window.location.href).toBe('/api/auth/google');
    expect(auth.isLoading.value).toBe(true);
  });
});
