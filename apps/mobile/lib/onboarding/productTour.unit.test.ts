import { describe, expect, it } from 'vitest';

import {
  parseProductTourSeen,
  PRODUCT_TOUR_STEPS,
  productTourSeenStorageKey,
  resolveTourTarget,
  shouldShowProductTour,
  tourStepAfterAction,
} from '@/lib/onboarding/productTour';

describe('parseProductTourSeen', () => {
  it('returns true only for the seen value', () => {
    expect(parseProductTourSeen('seen')).toBe(true);
  });

  it('treats missing or unknown values as not seen', () => {
    expect(parseProductTourSeen(null)).toBe(false);
    expect(parseProductTourSeen('')).toBe(false);
    expect(parseProductTourSeen('true')).toBe(false);
    expect(parseProductTourSeen('granted')).toBe(false);
  });
});

describe('productTourSeenStorageKey', () => {
  it('includes the user id', () => {
    expect(productTourSeenStorageKey(42)).toBe('product_tour_seen:42');
    expect(productTourSeenStorageKey('99')).toBe('product_tour_seen:99');
  });
});

describe('PRODUCT_TOUR_STEPS', () => {
  it('has four steps ending on invite', () => {
    expect(PRODUCT_TOUR_STEPS).toHaveLength(4);
    expect(PRODUCT_TOUR_STEPS.map((step) => step.id)).toEqual([
      'diary',
      'recipes',
      'shoppingList',
      'invite',
    ]);
  });
});

describe('resolveTourTarget', () => {
  it('resolves primary holes when registered', () => {
    expect(resolveTourTarget('diary', ['diary-plan'])).toBe('diary-plan');
    expect(resolveTourTarget('recipes', ['recipes-content'])).toBe('recipes-content');
    expect(
      resolveTourTarget('shoppingList', ['shopping-list-content'])
    ).toBe('shopping-list-content');
  });

  it('returns null when the primary hole is missing', () => {
    expect(resolveTourTarget('diary', ['recipes-content'])).toBeNull();
  });

  it('prefers profile-invite over the add-member button for invite', () => {
    expect(
      resolveTourTarget('invite', [
        'profile-add-family-member',
        'profile-invite',
      ])
    ).toBe('profile-invite');
  });

  it('falls back to profile-add-family-member for invite', () => {
    expect(resolveTourTarget('invite', ['profile-add-family-member'])).toBe(
      'profile-add-family-member'
    );
  });

  it('returns null when invite targets are missing', () => {
    expect(resolveTourTarget('invite', [])).toBeNull();
  });
});

describe('tourStepAfterAction', () => {
  it('advances on next without writing seen', () => {
    expect(tourStepAfterAction(0, 'next')).toEqual({
      nextIndex: 1,
      writeSeen: false,
    });
    expect(tourStepAfterAction(2, 'next')).toEqual({
      nextIndex: 3,
      writeSeen: false,
    });
  });

  it('closes and writes seen on next from the last step', () => {
    expect(tourStepAfterAction(3, 'next')).toEqual({
      nextIndex: null,
      writeSeen: true,
    });
  });

  it('goes previous on back without writing seen', () => {
    expect(tourStepAfterAction(2, 'back')).toEqual({
      nextIndex: 1,
      writeSeen: false,
    });
  });

  it('treats back on the first step like skip', () => {
    expect(tourStepAfterAction(0, 'back')).toEqual({
      nextIndex: null,
      writeSeen: true,
    });
  });

  it('closes and writes seen on skip and done', () => {
    expect(tourStepAfterAction(1, 'skip')).toEqual({
      nextIndex: null,
      writeSeen: true,
    });
    expect(tourStepAfterAction(3, 'done')).toEqual({
      nextIndex: null,
      writeSeen: true,
    });
  });
});

describe('shouldShowProductTour', () => {
  const base = {
    hasFamily: true,
    consentLoaded: true,
    consentChoice: 'granted' as const,
    seenLoaded: true,
    seen: false,
    replayRequested: false,
  };

  it('hides when consent is unloaded', () => {
    expect(
      shouldShowProductTour({
        ...base,
        consentLoaded: false,
        consentChoice: null,
      })
    ).toBe(false);
  });

  it('hides while consent choice is null', () => {
    expect(
      shouldShowProductTour({
        ...base,
        consentChoice: null,
      })
    ).toBe(false);
  });

  it('hides while the seen flag is still loading', () => {
    expect(
      shouldShowProductTour({
        ...base,
        seenLoaded: false,
      })
    ).toBe(false);
  });

  it('shows when not seen after consent is resolved', () => {
    expect(shouldShowProductTour(base)).toBe(true);
    expect(
      shouldShowProductTour({
        ...base,
        consentChoice: 'denied',
      })
    ).toBe(true);
  });

  it('hides when seen and not replaying', () => {
    expect(
      shouldShowProductTour({
        ...base,
        seen: true,
      })
    ).toBe(false);
  });

  it('shows on replay even when already seen', () => {
    expect(
      shouldShowProductTour({
        ...base,
        seen: true,
        replayRequested: true,
      })
    ).toBe(true);
  });

  it('hides when the user has no family', () => {
    expect(
      shouldShowProductTour({
        ...base,
        hasFamily: false,
      })
    ).toBe(false);
  });
});
