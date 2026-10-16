import { describe, expect, it } from 'vitest';

import { parseAnalyticsConsent } from '@/lib/analytics/consentChoice';

describe('parseAnalyticsConsent', () => {
  it('keeps an explicit choice', () => {
    expect(parseAnalyticsConsent('granted')).toBe('granted');
    expect(parseAnalyticsConsent('denied')).toBe('denied');
  });

  it('treats a missing or unknown value as undecided', () => {
    expect(parseAnalyticsConsent(null)).toBeNull();
    expect(parseAnalyticsConsent('')).toBeNull();
    expect(parseAnalyticsConsent('true')).toBeNull();
  });
});
