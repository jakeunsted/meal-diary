import { describe, expect, it } from 'vitest';

import { validateRegisterForm, type RegisterFormData } from '@/lib/auth/registerValidation';

const t = (key: string) => key;

const valid = (): RegisterFormData => ({
  username: 'Ada',
  email: 'ada@example.com',
  password: 'Password1!',
  confirm_password: 'Password1!',
  terms_accepted: true,
});

describe('validateRegisterForm', () => {
  it('accepts a complete form', () => {
    expect(validateRegisterForm(valid(), t)).toEqual({
      hasErrors: false,
      errors: {
        username: '',
        email: '',
        password: '',
        confirm_password: '',
        terms_accepted: '',
        general: '',
      },
    });
  });

  it('reports missing fields, an invalid email, a weak password, a mismatch, and terms', () => {
    const result = validateRegisterForm(
      {
        username: '  ',
        email: 'not-an-email',
        password: 'short',
        confirm_password: 'other',
        terms_accepted: false,
      },
      t
    );

    expect(result.hasErrors).toBe(true);
    expect(result.errors).toEqual({
      username: 'registration.errors.displayNameRequired',
      email: 'registration.errors.emailInvalid',
      password: 'registration.errors.passwordRequirements',
      confirm_password: 'registration.errors.passwordMismatch',
      terms_accepted: 'registration.errors.termsRequired',
      general: '',
    });
  });

  it('asks for a password and confirmation when they are empty', () => {
    const result = validateRegisterForm(
      { ...valid(), password: '', confirm_password: '' },
      t
    );

    expect(result.errors.password).toBe('registration.errors.passwordRequired');
    expect(result.errors.confirm_password).toBe('registration.errors.confirmPasswordRequired');
  });
});
