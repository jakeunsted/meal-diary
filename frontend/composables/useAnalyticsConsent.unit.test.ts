import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('~/utils/browserStorage', () => ({
  browserStorage: storage,
}));

import { useAnalyticsConsent } from './useAnalyticsConsent';

describe('useAnalyticsConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads a stored decision once, then grants and revokes it', async () => {
    storage.get.mockReturnValue('granted');
    const consent = useAnalyticsConsent();

    await expect(consent.loadConsent()).resolves.toBe(true);
    await consent.loadConsent();
    expect(storage.get).toHaveBeenCalledTimes(1);
    expect(consent.hasAnalyticsConsent.value).toBe(true);
    expect(consent.isConsentUndecided.value).toBe(false);

    await consent.revokeConsent();
    expect(consent.analyticsConsent.value).toBe(false);
    expect(storage.set).toHaveBeenCalledWith('analytics_consent', 'denied');

    await consent.grantConsent();
    expect(consent.analyticsConsent.value).toBe(true);
    expect(storage.set).toHaveBeenCalledWith('analytics_consent', 'granted');
  });
});
