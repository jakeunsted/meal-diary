import { Capacitor } from '@capacitor/core';

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

  const getPurchasesModule = async () => {
    if (!isNativePlatform.value) {
      return null;
    }
    return import('@revenuecat/purchases-capacitor');
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

    const purchasesModule = await getPurchasesModule();
    if (!purchasesModule) {
      return;
    }

    await purchasesModule.Purchases.setLogLevel({ level: purchasesModule.LOG_LEVEL.WARN });
    await purchasesModule.Purchases.configure({ apiKey });
    isConfigured.value = true;
  };

  const logIn = async (appUserId: string) => {
    await configure();
    if (!isConfigured.value) {
      return;
    }

    const purchasesModule = await getPurchasesModule();
    if (!purchasesModule) {
      return;
    }

    await purchasesModule.Purchases.logIn({ appUserId });
  };

  const purchasePackage = async (interval: 'month' | 'year') => {
    await configure();
    if (!isConfigured.value) {
      throw new Error('RevenueCat is not configured');
    }

    const purchasesModule = await getPurchasesModule();
    if (!purchasesModule) {
      throw new Error('RevenueCat is not available');
    }

    const offerings = await purchasesModule.Purchases.getOfferings();
    const selectedPackage = interval === 'year'
      ? offerings.current?.annual
      : offerings.current?.monthly;

    if (!selectedPackage) {
      throw new Error('Subscription package not found');
    }

    return purchasesModule.Purchases.purchasePackage({ aPackage: selectedPackage });
  };

  const restorePurchases = async () => {
    await configure();
    if (!isConfigured.value) {
      throw new Error('RevenueCat is not configured');
    }

    const purchasesModule = await getPurchasesModule();
    if (!purchasesModule) {
      throw new Error('RevenueCat is not available');
    }

    return purchasesModule.Purchases.restorePurchases();
  };

  return {
    configure,
    logIn,
    purchasePackage,
    restorePurchases,
    isNativePlatform,
  };
};
