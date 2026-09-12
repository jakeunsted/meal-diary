import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type PurchasesError,
  type PurchasesPackage,
} from 'react-native-purchases';

import { env } from '@/constants/env';
import { logWarn } from '@/lib/analytics/posthog';

export type BillingInterval = 'month' | 'year';

export interface OfferingPackages {
  monthly: PurchasesPackage | null;
  yearly: PurchasesPackage | null;
}

let configurePromise: Promise<boolean> | null = null;

const getApiKey = (): string => {
  if (Platform.OS === 'ios') {
    return env.revenueCatIosApiKey;
  }
  if (Platform.OS === 'android') {
    return env.revenueCatAndroidApiKey;
  }
  return '';
};

export const isNativeBillingAvailable = (): boolean =>
  Platform.OS !== 'web' && getApiKey().length > 0;

export const configurePurchases = async (): Promise<boolean> => {
  if (!isNativeBillingAvailable()) {
    return false;
  }

  if (configurePromise) {
    return configurePromise;
  }

  configurePromise = (async () => {
    try {
      const alreadyConfigured = await Purchases.isConfigured();
      if (alreadyConfigured) {
        return true;
      }

      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      Purchases.configure({ apiKey: getApiKey() });
      return true;
    } catch (error) {
      console.warn('[RevenueCat] configure failed', error);
      logWarn('RevenueCat configure failed', { category: 'billing' });
      configurePromise = null;
      return false;
    }
  })();

  return configurePromise;
};

export const logInPurchases = async (appUserId: string): Promise<void> => {
  const ready = await configurePurchases();
  if (!ready) {
    return;
  }

  await Purchases.logIn(appUserId);
};

export const logOutPurchases = async (): Promise<void> => {
  if (!isNativeBillingAvailable()) {
    return;
  }

  try {
    const ready = await Purchases.isConfigured();
    if (!ready) {
      return;
    }
    await Purchases.logOut();
  } catch (error) {
    console.warn('[RevenueCat] logOut failed', error);
    logWarn('RevenueCat logOut failed', { category: 'billing' });
  }
};

export const mapPackageInterval = (pkg: PurchasesPackage): BillingInterval | null => {
  const productId = pkg.product.identifier.toLowerCase();
  if (productId.includes('year') || productId.includes('annual')) {
    return 'year';
  }
  if (productId.includes('month')) {
    return 'month';
  }

  if (pkg.packageType === PACKAGE_TYPE.ANNUAL) {
    return 'year';
  }
  if (pkg.packageType === PACKAGE_TYPE.MONTHLY) {
    return 'month';
  }

  return null;
};

export const getOfferingPackages = async (): Promise<OfferingPackages> => {
  const ready = await configurePurchases();
  if (!ready) {
    return { monthly: null, yearly: null };
  }

  const offerings = await Purchases.getOfferings();
  const available = offerings.current?.availablePackages ?? [];

  let monthly: PurchasesPackage | null = null;
  let yearly: PurchasesPackage | null = null;

  for (const pkg of available) {
    const interval = mapPackageInterval(pkg);
    if (interval === 'month' && !monthly) {
      monthly = pkg;
    }
    if (interval === 'year' && !yearly) {
      yearly = pkg;
    }
  }

  return { monthly, yearly };
};

export const purchasePackage = async (pkg: PurchasesPackage): Promise<'purchased' | 'cancelled'> => {
  const ready = await configurePurchases();
  if (!ready) {
    throw new Error('Purchases is not configured');
  }

  try {
    await Purchases.purchasePackage(pkg);
    return 'purchased';
  } catch (error) {
    if (isPurchaseCancelledError(error)) {
      return 'cancelled';
    }
    throw error;
  }
};

export const restorePurchases = async (): Promise<void> => {
  const ready = await configurePurchases();
  if (!ready) {
    throw new Error('Purchases is not configured');
  }

  await Purchases.restorePurchases();
};

export const isPurchaseCancelledError = (error: unknown): boolean => {
  const purchasesError = error as PurchasesError | undefined;
  if (!purchasesError) {
    return false;
  }

  if (purchasesError.userCancelled) {
    return true;
  }

  return purchasesError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
};

export const getStoreSubscriptionsUrl = (): string => {
  if (Platform.OS === 'ios') {
    return 'https://apps.apple.com/account/subscriptions';
  }

  return `https://play.google.com/store/account/subscriptions?package=uk.co.mealdiary.app`;
};
