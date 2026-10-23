import { describe, expect, it } from 'vitest';
import { routeParam, routeParamInt } from '../routeParam.ts';

describe('routeParam', () => {
  it('returns a string param unchanged', () => {
    expect(routeParam('12')).toBe('12');
  });

  it('returns the first entry of an array param', () => {
    expect(routeParam(['7', '8'])).toBe('7');
  });

  it('returns an empty string for a missing or empty array param', () => {
    expect(routeParam(undefined)).toBe('');
    expect(routeParam([])).toBe('');
  });
});

describe('routeParamInt', () => {
  it('parses the first value as an integer', () => {
    expect(routeParamInt(['42', '9'])).toBe(42);
  });

  it('returns NaN when the param is missing', () => {
    expect(routeParamInt(undefined)).toBeNaN();
  });
});
