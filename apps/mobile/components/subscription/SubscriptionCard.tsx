import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { ProfileCard } from '@/components/profile/ProfileCard';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { openPlans, openWebManageBilling, openWebPlans } from '@/lib/billing/openPlans';
import { getStoreSubscriptionsUrl } from '@/lib/billing/purchases';
import type { ResolvedEntitlements } from '@/types/api';

interface SubscriptionCardProps {
  entitlements: ResolvedEntitlements | undefined;
}

export function SubscriptionCard({ entitlements }: SubscriptionCardProps) {
  const { t } = useTranslation();
  const router = useRouter();

  if (!entitlements) {
    return null;
  }

  const { plan, status, isComplimentary, billing, trial } = entitlements;
  const isPremium = plan === 'premium';
  const storePlatform = billing.storePlatform;
  const isStoreManaged = storePlatform === 'ios' || storePlatform === 'android';
  const isWebManaged = storePlatform === 'web';

  const planLabel = isComplimentary
    ? t('plansPage.complimentary')
    : isPremium
      ? t('plansPage.familyPlus')
      : t('plansPage.free');

  const handleViewPlans = () => {
    openPlans(router);
  };

  const handleManageSubscription = () => {
    if (isWebManaged) {
      openWebManageBilling();
      return;
    }
    if (isStoreManaged) {
      void Linking.openURL(getStoreSubscriptionsUrl());
      return;
    }
    handleViewPlans();
  };

  return (
    <ProfileCard title={t('plansPage.subscription')} className="mt-6">
      <Text className="text-ice mb-1 text-base">
        {t('plansPage.currentPlanLabel', { plan: planLabel })}
      </Text>

      {status === 'trialing' && trial ? (
        <Text className="text-ice/70 mb-3 text-sm">
          {t('plansPage.trialDaysRemaining', { days: String(trial.daysRemaining) })}
        </Text>
      ) : null}

      {status === 'payment_failed' ? (
        <Box className="mb-3 rounded-lg border border-warning/40 bg-warning/15 px-3 py-2">
          <Text className="text-ice text-sm">{t('plansPage.paymentFailed')}</Text>
        </Box>
      ) : null}

      {isComplimentary ? (
        <Text className="text-ice/70 mb-3 text-sm">{t('plansPage.complimentaryPlanMessage')}</Text>
      ) : null}

      {!billing.isOwner ? (
        <Text className="text-ice/70 mb-3 text-sm">
          {billing.ownerDisplayName
            ? t('plansPage.ownerManagesBilling', { name: billing.ownerDisplayName })
            : t('plansPage.askOwnerToUpgradeGeneric')}
        </Text>
      ) : null}

      <Box className="mt-2 gap-3">
        {billing.isOwner && isPremium && !isComplimentary ? (
          <Button
            variant="outline"
            className="w-full"
            onPress={handleManageSubscription}
            testID="subscription-manage-button"
          >
            <ButtonText>
              {isWebManaged ? t('plansPage.manageOnWeb') : t('plansPage.manageSubscription')}
            </ButtonText>
          </Button>
        ) : null}

        {billing.isOwner && !isPremium ? (
          <Button className="w-full" onPress={handleViewPlans} testID="subscription-view-plans">
            <ButtonText>{t('plansPage.viewPlans')}</ButtonText>
          </Button>
        ) : null}

        {billing.isOwner && isPremium && isWebManaged ? (
          <Button
            variant="ghost"
            className="w-full"
            onPress={openWebPlans}
            testID="subscription-web-plans"
          >
            <ButtonText>{t('plansPage.viewPlans')}</ButtonText>
          </Button>
        ) : null}
      </Box>
    </ProfileCard>
  );
}
