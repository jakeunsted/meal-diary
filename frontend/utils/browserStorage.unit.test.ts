import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browserStorage } from './browserStorage';

describe('browserStorage', () => {
  beforeEach(() => {
    const data: Record<string, string> = {
      'CapacitorStorage.authState': '{"accessToken":"old"}',
      'CapacitorStorage.analytics_consent': 'granted',
      authState: '{"accessToken":"kept"}',
    };
    vi.stubGlobal('localStorage', new Proxy(data, {
      get(target, prop) {
        if (prop === 'getItem') return (key: string) => target[key] ?? null;
        if (prop === 'setItem') return (key: string, value: string) => { target[key] = value; };
        if (prop === 'removeItem') return (key: string) => { delete target[key]; };
        if (prop === 'key') return (index: number) => Object.keys(target)[index] ?? null;
        if (prop === 'length') return Object.keys(target).length;
        return target[prop as string];
      },
    }));
  });

  it('stays empty when the page is not in the browser', () => {
    expect(browserStorage.get('authState')).toBeNull();
  });

  it('reads localStorage and deletes leftover Capacitor keys', () => {
    globalThis.__NUXT_CLIENT__ = true;

    expect(browserStorage.get('authState')).toBe('{"accessToken":"kept"}');
    expect(localStorage.getItem('CapacitorStorage.authState')).toBeNull();
    expect(localStorage.getItem('CapacitorStorage.analytics_consent')).toBeNull();

    browserStorage.set('shoppingList', '[]');
    expect(localStorage.getItem('shoppingList')).toBe('[]');

    browserStorage.remove('authState');
    expect(localStorage.getItem('authState')).toBeNull();
  });
});
