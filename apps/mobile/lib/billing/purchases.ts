import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
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

export const isExpoGo = (): boolean =>
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const isNativeBillingAvailable = (): boolean =>
  Platform.OS !== 'web' && !isExpoGo() && getApiKey().length > 0;

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

      await Purchases.setLogLevel(LOG_LEVEL.DEBUG);

      Purchases.configure({
        apiKey: getApiKey(),
        ...(Platform.OS === 'android' ? { store: 'PLAY_STORE' as const } : {}),
      });
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
  const current = offerings.current;
  const available = current?.availablePackages ?? [];

  if (!current || available.length === 0) {
    throw new Error(
      'No Play Store products were returned. Install the app from the Play testing track (not Expo Go or a sideload), confirm family_plus monthly/yearly are Active, and that RevenueCat Play credentials are valid. https://rev.cat/why-are-offerings-empty'
    );
  }

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
    try {
      await Purchases.syncPurchases();
    } catch (error) {
      console.warn('[RevenueCat] syncPurchases after purchase failed', error);
    }
    return 'purchased';
  } catch (error) {
    if (isPurchaseCancelledError(error)) {
      return 'cancelled';
    }
    throw error;
  }
};

export const subscribeToCustomerInfoUpdates = (
  listener: (info: CustomerInfo) => void
): (() => void) => {
  if (!isNativeBillingAvailable()) {
    return () => undefined;
  }

  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
};

export const restorePurchases = async (): Promise<void> => {
  const ready = await configurePurchases();
  if (!ready) {
    throw new Error('Purchases is not configured');
  }

  await Purchases.restorePurchases();
};

export const formatPurchasesError = (error: unknown): string => {
  const purchasesError = error as PurchasesError | undefined;
  if (!purchasesError || typeof purchasesError.message !== 'string') {
    return error instanceof Error ? error.message : 'Purchase failed';
  }

  const underlying = purchasesError.underlyingErrorMessage?.trim();
  const readable = purchasesError.userInfo?.readableErrorCode;
  const details = [readable, underlying].filter((part) => part && part !== purchasesError.message);
  if (details.length > 0) {
    return `${purchasesError.message} (${details.join(': ')})`;
  }

  return purchasesError.message;
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
