import { afterEach, describe, expect, it, vi } from 'vitest';

const authStore = { accessToken: 'access-token' as string | null };

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => authStore,
}));

import plugin from './sse';

const encoder = new TextEncoder();

const flush = async () => {
  for (let step = 0; step < 20; step += 1) {
    await Promise.resolve();
  }
};

const streamFrom = (frames: string[], options?: { hang?: boolean }) => {
  let index = 0;
  return {
    getReader: () => ({
      read: async () => {
        if (index >= frames.length) {
          if (options?.hang) {
            return new Promise(() => {});
          }
          return { done: true, value: undefined };
        }
        const value = encoder.encode(frames[index]);
        index += 1;
        return { done: false, value };
      },
    }),
  };
};

describe('sse plugin', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    authStore.accessToken = 'access-token';
  });

  it('sends the bearer token, dispatches frames, and reconnects after the stream ends', async () => {
    vi.useFakeTimers();
    globalThis.__NUXT_CLIENT__ = true;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        body: streamFrom(['data: {"type":"add-item","data":{"id":1}}\n\n', 'data: not-json\n\n']),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: streamFrom([], { hang: true }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const sse = plugin({} as never).provide.sse;
    const onAdd = vi.fn();
    sse.setup(9, { 'add-item': onAdd });
    await flush();

    expect(onAdd).toHaveBeenCalledWith({ id: 1 });
    expect(fetchMock).toHaveBeenCalledWith('/api/server-sent-events/9', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
    }));

    await vi.advanceTimersByTimeAsync(5000);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    sse.close();
  });

  it('does not open a stream without an access token', async () => {
    vi.useFakeTimers();
    globalThis.__NUXT_CLIENT__ = true;
    authStore.accessToken = null;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const sse = plugin({} as never).provide.sse;
    sse.setup(9, {});
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).not.toHaveBeenCalled();
    sse.close();
  });
});
