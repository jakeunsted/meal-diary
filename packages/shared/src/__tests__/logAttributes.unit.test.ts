import { describe, expect, it } from 'vitest';

import { toLogAttributes } from '../logAttributes.ts';

describe('toLogAttributes', () => {
  it('returns an empty object when properties are missing', () => {
    expect(toLogAttributes()).toEqual({});
    expect(toLogAttributes(undefined)).toEqual({});
  });

  it('keeps string, number, and boolean values', () => {
    expect(
      toLogAttributes({
        path: '/auth/login',
        status: 500,
        retry: false,
      })
    ).toEqual({
      path: '/auth/login',
      status: 500,
      retry: false,
    });
  });

  it('maps session_id to sessionId for replay linking', () => {
    expect(
      toLogAttributes({
        session_id: 'abc123',
        event: 'oauth_callback_client_error',
      })
    ).toEqual({
      sessionId: 'abc123',
      event: 'oauth_callback_client_error',
    });
  });

  it('drops objects, arrays, null, and undefined', () => {
    expect(
      toLogAttributes({
        nested: { foo: 'bar' },
        tags: ['a', 'b'],
        empty: null,
        missing: undefined,
        ok: 'kept',
      })
    ).toEqual({ ok: 'kept' });
  });
});
