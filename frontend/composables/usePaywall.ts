import type { EntitlementFeature } from '~/types/Entitlements';

export interface PaywallCopy {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string | null;
  isOwner: boolean;
}

export const usePaywall = () => {
  const activeFeature = useState<EntitlementFeature | null>('paywall-active-feature', () => null);
  const subscriptionStore = useSubscriptionStore();
  const { t } = useI18n();

  const isOpen = computed(() => activeFeature.value !== null);

  const billing = computed(() => subscriptionStore.entitlements?.billing ?? {
    isOwner: false,
    ownerDisplayName: null,
  });

  const openPaywall = (feature: EntitlementFeature) => {
    activeFeature.value = feature;
  };

  const closePaywall = () => {
    activeFeature.value = null;
  };

  const getPaywallCopy = (feature: EntitlementFeature): PaywallCopy => {
    const isOwner = billing.value.isOwner;
    const ownerName = billing.value.ownerDisplayName;

    const title = t(`paywall.${feature}.title`);
    const description = t(`paywall.${feature}.description`);

    if (isOwner) {
      return {
        title,
        description,
        ctaLabel: t(`paywall.${feature}.ownerCta`),
        ctaHref: '/plans',
        isOwner: true,
      };
    }

    return {
      title,
      description,
      ctaLabel: ownerName
        ? t(`paywall.${feature}.nonOwnerCta`, { name: ownerName })
        : t(`paywall.${feature}.nonOwnerCtaGeneric`),
      ctaHref: null,
      isOwner: false,
    };
  };

  const activePaywallCopy = computed(() => {
    if (!activeFeature.value) {
      return null;
    }
    return getPaywallCopy(activeFeature.value);
  });

  return {
    activeFeature,
    isOpen,
    billing,
    openPaywall,
    closePaywall,
    getPaywallCopy,
    activePaywallCopy,
  };
};
