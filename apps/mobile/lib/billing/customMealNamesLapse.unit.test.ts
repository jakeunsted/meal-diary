import { describe, expect, it } from 'vitest';

import {
  customMealNamesRenewRoute,
  shouldShowCustomMealNamesLapse,
} from '@/lib/billing/customMealNamesLapse';

describe('customMealNamesRenewRoute', () => {
  it('sends a web store to the website, including when native billing is available', () => {
    expect(
      customMealNamesRenewRoute({
        isOwner: true,
        storePlatform: 'web',
        nativeBillingAvailable: true,
      })
    ).toBe('web');
  });

  it('sends an Android store to the in-app plans screen when native billing is available', () => {
    expect(
      customMealNamesRenewRoute({
        isOwner: true,
        storePlatform: 'android',
        nativeBillingAvailable: true,
      })
    ).toBe('plans');
  });

  it('sends Android to the website when native billing is unavailable', () => {
    expect(
      customMealNamesRenewRoute({
        isOwner: true,
        storePlatform: 'android',
        nativeBillingAvailable: false,
      })
    ).toBe('web');
  });

  it('gives a non-owner no route', () => {
    expect(
      customMealNamesRenewRoute({
        isOwner: false,
        storePlatform: 'android',
        nativeBillingAvailable: true,
      })
    ).toBe('none');
  });
});

describe('custom meal names lapse visit hide', () => {
  const ready = {
    prompt: true as const,
    entitlementsReady: true,
    paywallOpen: false,
    plansScreenOpen: false,
  };

  it('hides for the rest of the visit after a dismiss and shows on a new visit', () => {
    expect(
      shouldShowCustomMealNamesLapse({ ...ready, dismissedThisVisit: false })
    ).toBe(true);
    expect(
      shouldShowCustomMealNamesLapse({ ...ready, dismissedThisVisit: true })
    ).toBe(false);
    expect(
      shouldShowCustomMealNamesLapse({ ...ready, dismissedThisVisit: false })
    ).toBe(true);
  });

  it('stays closed when entitlements failed to load', () => {
    expect(
      shouldShowCustomMealNamesLapse({
        ...ready,
        entitlementsReady: false,
        dismissedThisVisit: false,
      })
    ).toBe(false);
  });

  it('waits while the paywall is open', () => {
    expect(
      shouldShowCustomMealNamesLapse({
        ...ready,
        paywallOpen: true,
        dismissedThisVisit: false,
      })
    ).toBe(false);
  });

  it('waits while the in-app plans screen is open', () => {
    expect(
      shouldShowCustomMealNamesLapse({
        ...ready,
        plansScreenOpen: true,
        dismissedThisVisit: false,
      })
    ).toBe(false);
  });
});
