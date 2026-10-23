import { describe, expect, it, vi } from 'vitest';

const api = vi.fn();

vi.mock('./useApi', () => ({
  useApi: () => ({ api }),
}));

import { useConnection } from './useConnection';

describe('useConnection', () => {
  it('reports a connection when the health check succeeds and false when it fails', async () => {
    api.mockResolvedValueOnce({ ok: true });
    const { checkConnection } = useConnection();

    await expect(checkConnection(1000)).resolves.toBe(true);
    expect(api).toHaveBeenCalledWith('/api/health', { method: 'get', timeout: 1000 });

    api.mockRejectedValueOnce(new Error('offline'));
    await expect(checkConnection()).resolves.toBe(false);
  });
});
