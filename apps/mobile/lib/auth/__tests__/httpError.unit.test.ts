import { describe, expect, it } from 'vitest';

import { isNetworkError } from '@/lib/auth/httpError';

describe('isNetworkError', () => {
  it('treats an Android connection failure as offline', () => {
    const error = new Error(
      'fetch failed: java.net.ConnectException: Failed to connect to /192.168.1.201:3001'
    );

    expect(isNetworkError(error)).toBe(true);
  });

  it('leaves a server validation message as an online error', () => {
    expect(isNetworkError(new Error('Recipe does not belong to this family'))).toBe(false);
  });
});
