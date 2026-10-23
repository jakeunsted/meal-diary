import { describe, expect, it } from 'vitest';
import { normalizeEmail } from '../normalizeEmail.ts';

describe('normalizeEmail', () => {
  it('trims and lowercases a normal address', () => {
    expect(normalizeEmail('  Ada@Example.com ')).toBe('ada@example.com');
  });

  it('strips plus aliases', () => {
    expect(normalizeEmail('Ada+news@Example.com')).toBe('ada@example.com');
  });

  it('strips dots only for Gmail and Googlemail', () => {
    expect(normalizeEmail('a.da+x@gmail.com')).toBe('ada@gmail.com');
    expect(normalizeEmail('a.da@googlemail.com')).toBe('ada@googlemail.com');
  });

  it('keeps dots on other domains', () => {
    expect(normalizeEmail('a.da+x@example.com')).toBe('a.da@example.com');
  });

  it('returns the lowercased input when there is no domain', () => {
    expect(normalizeEmail('  NotAnEmail ')).toBe('notanemail');
  });
});
