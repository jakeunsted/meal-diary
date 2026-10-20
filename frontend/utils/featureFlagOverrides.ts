export const FEATURE_FLAG_OVERRIDES_KEY = '__mealDiaryFeatureFlags';

type FeatureFlagOverrideWindow = Window & {
  __mealDiaryFeatureFlags?: Record<string, boolean>;
};

/**
 * Cypress sets this on the window before the app boots.
 * Missing keys stay fail-closed.
 */
export const readFeatureFlagOverride = (key: string): boolean | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const overrides = (window as FeatureFlagOverrideWindow)[FEATURE_FLAG_OVERRIDES_KEY];
  if (!overrides || !Object.prototype.hasOwnProperty.call(overrides, key)) {
    return undefined;
  }

  return overrides[key] === true;
};

export const applyFeatureFlagOverrides = (
  win: Window,
  flags: Record<string, boolean>,
) => {
  (win as FeatureFlagOverrideWindow)[FEATURE_FLAG_OVERRIDES_KEY] = { ...flags };
};
