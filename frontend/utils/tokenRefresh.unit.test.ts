import { describe, expect, it, vi } from 'vitest';
import { isTokenRefreshInProgress, runWithTokenRefreshLock } from './tokenRefresh';

describe('runWithTokenRefreshLock', () => {
  it('shares one in-flight refresh across callers', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const refresh = vi.fn(() => gate);

    const first = runWithTokenRefreshLock(refresh);
    const second = runWithTokenRefreshLock(refresh);

    expect(isTokenRefreshInProgress()).toBe(true);
    release();
    await Promise.all([first, second]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(isTokenRefreshInProgress()).toBe(false);
  });

  it('lets the next caller retry after a failed refresh', async () => {
    const refresh = vi.fn()
      .mockRejectedValueOnce(new Error('rotated'))
      .mockResolvedValueOnce(undefined);

    await expect(runWithTokenRefreshLock(refresh)).rejects.toThrow('rotated');
    await runWithTokenRefreshLock(refresh);

    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
