import { afterEach, describe, expect, it, vi } from 'vitest';
import plugin from './suppress-warnings';

describe('suppress-warnings plugin', () => {
  const originalWarn = console.warn;

  afterEach(() => {
    console.warn = originalWarn;
  });

  it('drops the unmatched-route warning in development', () => {
    const warn = vi.fn();
    console.warn = warn;
    (process as NodeJS.Process & { dev?: boolean }).dev = true;

    plugin();
    console.warn('No match found for location with path "/missing"');
    console.warn('Something else');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Something else');
  });
});
