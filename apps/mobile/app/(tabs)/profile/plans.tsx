import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PricingCards } from '@/components/subscription/PricingCards';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { Text } from '@/components/ui/text';
import { openWebManageBilling, openWebPlans } from '@/lib/billing/openPlans';
import {
  getStoreSubscriptionsUrl,
  isNativeBillingAvailable,
  type BillingInterval,
} from '@/lib/billing/purchases';
import { usePurchasePremium } from '@/lib/billing/usePurchasePremium';
import { useCurrentUser, useEntitlements } from '@/lib/queries/profile';

export default function PlansScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userQuery = useCurrentUser();
  const familyGroupId = userQuery.data?.family_group_id;
  const entitlementsQuery = useEntitlements(familyGroupId);
  const entitlements = entitlementsQuery.data;

  const {
    offerings,
    error,
    setError,
    isPurchasing,
    isRestoring,
    isLoadingOfferings,
    loadOfferings,
    purchaseInterval,
    restore,
  } = usePurchasePremium(familyGroupId);

  const nativeBilling = isNativeBillingAvailable();
  const billing = entitlements?.billing;
  const isOwner = billing?.isOwner ?? false;
  const isPremium = entitlements?.plan === 'premium';
  const isComplimentary = entitlements?.isComplimentary ?? false;
  const storePlatform = billing?.storePlatform ?? null;
  const isWebManaged = storePlatform === 'web';
  const isStoreManaged = storePlatform === 'ios' || storePlatform === 'android';
  const trialAvailable = billing?.trialAvailable ?? false;

  useEffect(() => {
    if (!nativeBilling || !isOwner || isPremium || isComplimentary || isWebManaged) {
      return;
    }
    void loadOfferings();
  }, [nativeBilling, isOwner, isPremium, isComplimentary, isWebManaged, loadOfferings]);

  const helperText = useMemo(() => {
    if (!isOwner) {
      return billing?.ownerDisplayName
        ? t('plansPage.ownerManagesBilling', { name: billing.ownerDisplayName })
        : t('plansPage.askOwnerToUpgradeGeneric');
    }
    if (!nativeBilling) {
      return t('plansPage.nativeBillingUnavailable');
    }
    return null;
  }, [billing?.ownerDisplayName, isOwner, nativeBilling, t]);

  const showPurchaseButtons =
    isOwner &&
    !isPremium &&
    !isComplimentary &&
    !isWebManaged &&
    nativeBilling;

  const canPurchase = showPurchaseButtons && !isPurchasing && !isRestoring;

  const handlePurchase = async (interval: BillingInterval) => {
    const result = await purchaseInterval(interval);
    if (result === 'purchased') {
      void entitlementsQuery.refetch();
    }
  };

  const handleRestore = async () => {
    const result = await restore();
    if (result === 'restored') {
      void entitlementsQuery.refetch();
    }
  };

  const handleManageSubscription = () => {
    if (isWebManaged) {
      openWebManageBilling();
      return;
    }
    if (isStoreManaged) {
      void Linking.openURL(getStoreSubscriptionsUrl());
    }
  };

  const handleOpenWebPlans = () => {
    openWebPlans();
  };

  return (
    <Box className="flex-1 bg-base" testID="plans-screen">
      <ScrollView
        contentContainerClassName="pb-8"
        contentContainerStyle={{ paddingTop: insets.top + 24 }}
      >
        <Box className="mx-4">
        <Pressable
          accessibilityRole="button"
          className="mb-4 flex-row items-center gap-2 py-2 self-start"
          onPress={() => router.back()}
          testID="plans-back-button"
        >
          <FontAwesome name="chevron-left" size={14} color="#F1F5F9" />
          <Text className="text-ice">{t('common.back')}</Text>
        </Pressable>

        <ScreenTitle align="left" className="mb-2">
          {t('plansPage.title')}
        </ScreenTitle>
        <Text className="text-ice/70 mb-6 text-sm">{t('plansPage.intro')}</Text>

        {entitlementsQuery.isLoading ? (
          <Box className="items-center py-10">
            <ActivityIndicator size="large" color="#6366F1" />
          </Box>
        ) : (
          <>
            {isComplimentary ? (
              <Box className="mb-4 rounded-2xl border border-primary/40 bg-primary/15 px-4 py-3">
                <Text className="text-ice text-sm">{t('plansPage.complimentaryPlanMessage')}</Text>
              </Box>
            ) : null}

            {isPremium && isWebManaged ? (
              <Box className="mb-4 gap-3">
                <Box className="rounded-2xl border border-white/10 bg-surface px-4 py-3">
                  <Text className="text-ice text-sm">{t('plansPage.managedOnWeb')}</Text>
                </Box>
                <Button onPress={handleOpenWebPlans} testID="plans-manage-web">
                  <ButtonText>{t('plansPage.manageOnWeb')}</ButtonText>
                </Button>
              </Box>
            ) : null}

            {isPremium && isStoreManaged ? (
              <Box className="mb-4 gap-3">
                <Box className="rounded-2xl border border-white/10 bg-surface px-4 py-3">
                  <Text className="text-ice text-sm">
                    {t('plansPage.currentPlanLabel', { plan: t('plansPage.familyPlus') })}
                  </Text>
                </Box>
                <Button
                  variant="outline"
                  onPress={handleManageSubscription}
                  testID="plans-manage-store"
                >
                  <ButtonText>{t('plansPage.manageSubscription')}</ButtonText>
                </Button>
              </Box>
            ) : null}

            {!isPremium || (!isWebManaged && !isStoreManaged && !isComplimentary) ? (
              <PricingCards
                monthlyPriceLabel={offerings.monthly?.product.priceString ?? null}
                yearlyPriceLabel={offerings.yearly?.product.priceString ?? null}
                trialAvailable={trialAvailable}
                canPurchase={canPurchase}
                showPurchaseButtons={showPurchaseButtons}
                helperText={helperText}
                loadingInterval={isPurchasing}
                onPurchase={handlePurchase}
              />
            ) : null}

            {!nativeBilling && isOwner && !isPremium ? (
              <Box className="mt-4 gap-3">
                <Text className="text-ice/70 text-sm text-center">
                  {t('plansPage.nativeBillingUnavailable')}
                </Text>
                <Button onPress={handleOpenWebPlans} testID="plans-fallback-web">
                  <ButtonText>{t('plansPage.viewWebPlans')}</ButtonText>
                </Button>
              </Box>
            ) : null}

            {showPurchaseButtons ? (
              <Box className="mt-6 gap-3">
                <Button
                  variant="outline"
                  disabled={isRestoring || !!isPurchasing || isLoadingOfferings}
                  onPress={handleRestore}
                  testID="plans-restore-purchases"
                >
                  {isRestoring ? <ButtonSpinner color="#F1F5F9" /> : null}
                  <ButtonText>{t('plansPage.restorePurchases')}</ButtonText>
                </Button>
              </Box>
            ) : null}

            {error ? (
              <Text className="text-red-400 text-sm text-center mt-4" onPress={() => setError(null)}>
                {error}
              </Text>
            ) : null}

            <Box className="mt-8 gap-2">
              <Heading size="sm" className="text-ice mb-1">
                {t('plansPage.compareTitle')}
              </Heading>
              {(
                [
                  'familyMembers',
                  'weeksAhead',
                  'editPastWeeks',
                  'recipes',
                  'recipeToShoppingList',
                ] as const
              ).map((row) => (
                <Text key={row} className="text-ice/70 text-sm">
                  • {t(`plansPage.rows.${row}`)}
                </Text>
              ))}
            </Box>
          </>
        )}
        </Box>
      </ScrollView>
    </Box>
  );
}
