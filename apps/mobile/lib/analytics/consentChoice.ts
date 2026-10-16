export type AnalyticsConsentChoice = 'granted' | 'denied' | null;

export function parseAnalyticsConsent(value: string | null): AnalyticsConsentChoice {
  if (value === 'granted' || value === 'denied') {
    return value;
  }
  return null;
}
