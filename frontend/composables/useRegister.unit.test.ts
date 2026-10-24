import { beforeEach, describe, expect, it, vi } from 'vitest';

const preferences = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: preferences,
}));

import { useRegister } from './useRegister';

const valid = {
  username: 'Ada',
  email: 'ada@example.com',
  password: 'Password1!',
  confirm_password: 'Password1!',
  terms_accepted: true,
  hasErrors: false,
};

describe('useRegister', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferences.get.mockResolvedValue({ value: 'able-boat-calm' });
  });

  it('stores and clears the family invite code', async () => {
    const register = useRegister();
    await register.storeRegisterString('able-boat-calm');
    expect(preferences.set).toHaveBeenCalledWith({ key: 'registerString', value: 'able-boat-calm' });
    await register.deleteRegisterString();
    expect(preferences.remove).toHaveBeenCalledWith({ key: 'registerString' });
  });

  it('rejects an incomplete form before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await useRegister().performRegistration({
      ...valid,
      username: ' ',
      email: 'not-an-email',
      password: 'short',
      confirm_password: '',
      terms_accepted: false,
    });

    expect(result.hasErrors).toBe(true);
    expect(result.errors.username).toBe('registration.errors.displayNameRequired');
    expect(result.errors.email).toBe('registration.errors.emailInvalid');
    expect(result.errors.password).toBe('registration.errors.passwordRequirements');
    expect(result.errors.confirm_password).toBe('registration.errors.passwordMismatch');
    expect(result.errors.terms_accepted).toBe('registration.errors.termsRequired');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('registers a valid user and maps duplicate and full-family responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 201 })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ message: 'exists' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ data: { code: 'ENTITLEMENT_REQUIRED', feature: 'family_members' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const register = useRegister();
    const created = await register.performRegistration(valid);
    expect(created.hasErrors).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('/api/user', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"family_group_code":"able-boat-calm"'),
    }));

    const duplicate = await register.performRegistration(valid);
    expect(duplicate.errors.general).toBe('registration.errors.duplicateAccount');

    const full = await register.performRegistration(valid);
    expect(full.errors.general).toBe('registrationStep2.familyGroupFull');
  });
});
