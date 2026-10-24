import { describe, expect, it } from 'vitest';
import { decodeJWT, isTokenExpired } from './useJWT';

const token = (payload: Record<string, unknown>) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${body}.signature`;
};

describe('useJWT', () => {
  it('decodes a payload and rejects a malformed token', () => {
    expect(decodeJWT(token({ exp: 100, sub: 'ada' }))).toEqual({ exp: 100, sub: 'ada' });
    expect(decodeJWT('not-a-jwt')).toBeNull();
    expect(decodeJWT('a.%%% .c')).toBeNull();
  });

  it('treats missing, past, and near-expiry tokens as expired', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(isTokenExpired('not-a-jwt')).toBe(true);
    expect(isTokenExpired(token({ sub: 'ada' }))).toBe(true);
    expect(isTokenExpired(token({ exp: nowSeconds - 10 }))).toBe(true);
    expect(isTokenExpired(token({ exp: nowSeconds + 30 }))).toBe(true);
    expect(isTokenExpired(token({ exp: nowSeconds + 3600 }))).toBe(false);
  });
});
