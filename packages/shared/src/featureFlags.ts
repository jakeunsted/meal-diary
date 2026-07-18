/**
 * PostHog feature flag keys shared by API, Nuxt, and Expo.
 * Add new keys here first, then create the matching flag in the PostHog UI.
 */
export const FEATURE_FLAGS = {
  /** Plumbing check — not used to gate product UI */
  featureFlagsEnabled: 'feature_flags_enabled',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];
