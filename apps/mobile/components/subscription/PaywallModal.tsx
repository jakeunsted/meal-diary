import type { EntitlementFeature } from '@meal-diary/shared';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { env } from '@/constants/env';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { useCurrentUser, useEntitlements } from '@/lib/queries/profile';

function getPaywallCopy(
  feature: EntitlementFeature,
  isOwner: boolean,
  ownerDisplayName: string | null,
  t: (key: string, options?: Record<string, string>) => string
) {
  const title = t(`paywall.${feature}.title`);
  const description = t(`paywall.${feature}.description`);

  if (isOwner) {
    return {
      title,
      description,
      ctaLabel: t(`paywall.${feature}.ownerCta`),
      showCtaLink: true,
    };
  }

  return {
    title,
    description,
    ctaLabel: ownerDisplayName
      ? t(`paywall.${feature}.nonOwnerCta`, { name: ownerDisplayName })
      : t(`paywall.${feature}.nonOwnerCtaGeneric`),
    showCtaLink: false,
  };
}

export function PaywallModal() {
  const { t } = useTranslation();
  const activeFeature = usePaywallStore((state) => state.activeFeature);
  const closePaywall = usePaywallStore((state) => state.closePaywall);
  const userQuery = useCurrentUser();
  const entitlementsQuery = useEntitlements(userQuery.data?.family_group_id);

  const billing = entitlementsQuery.data?.billing ?? {
    isOwner: false,
    ownerDisplayName: null,
  };

  const handleClose = () => {
    closePaywall();
  };

  const handleOpenPlans = () => {
    handleClose();
    void Linking.openURL(`${env.webUrl}/plans`);
  };

  if (!activeFeature) {
    return null;
  }

  const copy = getPaywallCopy(
    activeFeature,
    billing.isOwner,
    billing.ownerDisplayName,
    t
  );

  return (
    <DialogModal visible onClose={handleClose} testID="paywall-modal">
      <DialogPanel>
          <Heading size="lg" className="text-ice mb-3">
            {copy.title}
          </Heading>
          <Text className="text-ice/70 mb-6">{copy.description}</Text>

          <Box className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onPress={handleClose}>
              <ButtonText>{t('paywall.close')}</ButtonText>
            </Button>
            {copy.showCtaLink ? (
              <Button onPress={handleOpenPlans} testID="paywall-modal-cta">
                <ButtonText>{copy.ctaLabel}</ButtonText>
              </Button>
            ) : (
              <Button disabled testID="paywall-modal-cta">
                <ButtonText>{copy.ctaLabel}</ButtonText>
              </Button>
            )}
          </Box>
      </DialogPanel>
    </DialogModal>
  );
}
