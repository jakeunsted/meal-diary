import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';

export const useRevenueCat = () => {
  const config = useRuntimeConfig();
  const isConfigured = ref(false);

  const isNativePlatform = computed(() => Capacitor.isNativePlatform());

  const getApiKey = (): string | null => {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') {
      return config.public.revenueCatIosPublicKey || null;
    }
    if (platform === 'android') {
      return config.public.revenueCatAndroidPublicKey || null;
    }
    return null;
  };

  const configure = async () => {
    if (!isNativePlatform.value || isConfigured.value) {
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      console.warn('[RevenueCat] Public SDK key is not configured');
      return;
    }

    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    await Purchases.configure({ apiKey });
    isConfigured.value = true;
  };

  const logIn = async (appUserId: string) => {
    await configure();
    if (!isConfigured.value) {
      return;
    }

    await Purchases.logIn({ appUserId });
  };

  const purchasePackage = async (interval: 'month' | 'year') => {
    await configure();
    if (!isConfigured.value) {
      throw new Error('RevenueCat is not configured');
    }

    const offerings = await Purchases.getOfferings();
    const selectedPackage = interval === 'year'
      ? offerings.current?.annual
      : offerings.current?.monthly;

    if (!selectedPackage) {
      throw new Error('Subscription package not found');
    }

    return Purchases.purchasePackage({ aPackage: selectedPackage });
  };

  const restorePurchases = async () => {
    await configure();
    if (!isConfigured.value) {
      throw new Error('RevenueCat is not configured');
    }

    return Purchases.restorePurchases();
  };

  return {
    configure,
    logIn,
    purchasePackage,
    restorePurchases,
    isNativePlatform,
  };
};
