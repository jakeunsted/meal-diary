import { describe, expect, it } from 'vitest';

import {
  evaluatePassword,
  isPasswordValid,
  isValidEmail,
} from '../authValidation.ts';

describe('isValidEmail', () => {
  it('accepts typical email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('New@Example.com')).toBe(true);
    expect(isValidEmail('a@b.co')).toBe(true);
  });

  it('rejects malformed or hostile inputs in linear time', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('child')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user@example')).toBe(false);
    expect(isValidEmail('user @example.com')).toBe(false);
    expect(isValidEmail('!@!.' + '!.'.repeat(10_000))).toBe(false);
    expect(isValidEmail('a@b.co' + 'x'.repeat(250))).toBe(false);
  });
});

describe('password requirements', () => {
  it('reports each unmet and met requirement', () => {
    expect(evaluatePassword('short')).toEqual([
      { id: 'minLength', met: false },
      { id: 'lowercase', met: true },
      { id: 'uppercase', met: false },
      { id: 'number', met: false },
      { id: 'special', met: false },
    ]);

    expect(evaluatePassword('Password1!')).toEqual([
      { id: 'minLength', met: true },
      { id: 'lowercase', met: true },
      { id: 'uppercase', met: true },
      { id: 'number', met: true },
      { id: 'special', met: true },
    ]);
  });

  it('accepts only passwords that meet every requirement', () => {
    expect(isPasswordValid('Password1!')).toBe(true);
    expect(isPasswordValid('password1!')).toBe(false);
    expect(isPasswordValid('PASSWORD1!')).toBe(false);
    expect(isPasswordValid('Password!')).toBe(false);
    expect(isPasswordValid('Password1')).toBe(false);
    expect(isPasswordValid('Pass1!')).toBe(false);
  });
});
