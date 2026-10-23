export interface CustomMealNamesRenewInput {
  isOwner: boolean;
  storePlatform: 'web' | 'ios' | 'android' | null;
  nativeBillingAvailable: boolean;
}

export type CustomMealNamesRenewRoute = 'web' | 'plans' | 'none';

export interface CustomMealNamesLapseVisibility {
  prompt: boolean | undefined;
  entitlementsReady: boolean;
  paywallOpen: boolean;
  plansScreenOpen: boolean;
  dismissedThisVisit: boolean;
}

export function customMealNamesRenewRoute(
  input: CustomMealNamesRenewInput
): CustomMealNamesRenewRoute {
  if (!input.isOwner) {
    return 'none';
  }
  if (input.storePlatform === 'web') {
    return 'web';
  }
  if (
    (input.storePlatform === 'android' || input.storePlatform === 'ios') &&
    input.nativeBillingAvailable
  ) {
    return 'plans';
  }
  return 'web';
}

export function shouldShowCustomMealNamesLapse(
  input: CustomMealNamesLapseVisibility
): boolean {
  if (!input.entitlementsReady || input.prompt !== true) {
    return false;
  }
  if (input.paywallOpen || input.plansScreenOpen) {
    return false;
  }
  return !input.dismissedThisVisit;
}
