import { beforeEach, describe, expect, it, vi } from 'vitest';

const preferences = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: preferences,
}));

import { useAnalyticsConsent } from './useAnalyticsConsent';

describe('useAnalyticsConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads a stored decision once, then grants and revokes it', async () => {
    preferences.get.mockResolvedValue({ value: 'granted' });
    const consent = useAnalyticsConsent();

    await expect(consent.loadConsent()).resolves.toBe(true);
    await consent.loadConsent();
    expect(preferences.get).toHaveBeenCalledTimes(1);
    expect(consent.hasAnalyticsConsent.value).toBe(true);
    expect(consent.isConsentUndecided.value).toBe(false);

    await consent.revokeConsent();
    expect(consent.analyticsConsent.value).toBe(false);
    expect(preferences.set).toHaveBeenCalledWith({ key: 'analytics_consent', value: 'denied' });

    await consent.grantConsent();
    expect(consent.analyticsConsent.value).toBe(true);
    expect(preferences.set).toHaveBeenCalledWith({ key: 'analytics_consent', value: 'granted' });
  });
});
