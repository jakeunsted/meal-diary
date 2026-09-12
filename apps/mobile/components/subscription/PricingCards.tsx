import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import type { BillingInterval } from '@/lib/billing/purchases';

interface PricingCardsProps {
  monthlyPriceLabel: string | null;
  yearlyPriceLabel: string | null;
  trialAvailable: boolean;
  canPurchase: boolean;
  showPurchaseButtons: boolean;
  helperText: string | null;
  loadingInterval: BillingInterval | null;
  onPurchase: (interval: BillingInterval) => void;
}

export function PricingCards({
  monthlyPriceLabel,
  yearlyPriceLabel,
  trialAvailable,
  canPurchase,
  showPurchaseButtons,
  helperText,
  loadingInterval,
  onPurchase,
}: PricingCardsProps) {
  const { t } = useTranslation();

  const ctaLabel = trialAvailable
    ? t('plansPage.startFreeTrial')
    : t('plansPage.subscribeNow');

  return (
    <Box className="gap-4" testID="pricing-cards">
      <Box className="rounded-2xl bg-surface border border-white/10 px-5 py-5">
        <Heading size="md" className="text-ice mb-1">
          {t('plansPage.free')}
        </Heading>
        <Text className="text-ice text-3xl font-semibold mb-2">£0</Text>
        <Text className="text-ice/70 text-sm mb-4">{t('plansPage.freeDescription')}</Text>
        <Box className="self-start rounded-full bg-white/10 px-3 py-1">
          <Text className="text-ice/80 text-xs">{t('plansPage.currentPlanBadge')}</Text>
        </Box>
      </Box>

      <Box className="rounded-2xl bg-surface border border-primary px-5 py-5">
        <Box className="mb-1 flex-row flex-wrap items-center gap-2">
          <Heading size="md" className="text-ice">
            {t('plansPage.monthly')}
          </Heading>
          {trialAvailable ? (
            <Box className="rounded-full bg-primary/30 px-2 py-0.5">
              <Text className="text-ice text-xs">{t('plansPage.trialBadge')}</Text>
            </Box>
          ) : null}
        </Box>
        <Text className="text-ice text-3xl font-semibold mb-4">
          {monthlyPriceLabel ?? t('plansPage.priceUnavailable')}
        </Text>
        {showPurchaseButtons ? (
          <>
            <Button
              className="w-full"
              disabled={!canPurchase || loadingInterval === 'month' || !monthlyPriceLabel}
              onPress={() => onPurchase('month')}
              testID="plans-purchase-monthly"
            >
              {loadingInterval === 'month' ? <ButtonSpinner color="#F1F5F9" /> : null}
              <ButtonText>{ctaLabel}</ButtonText>
            </Button>
            {helperText ? (
              <Text className="text-ice/60 text-xs text-center mt-2">{helperText}</Text>
            ) : null}
          </>
        ) : null}
      </Box>

      <Box className="rounded-2xl bg-surface border border-primary px-5 py-5">
        <Box className="mb-1 flex-row flex-wrap items-center gap-2">
          <Heading size="md" className="text-ice">
            {t('plansPage.yearly')}
          </Heading>
          {trialAvailable ? (
            <Box className="rounded-full bg-primary/30 px-2 py-0.5">
              <Text className="text-ice text-xs">{t('plansPage.trialBadge')}</Text>
            </Box>
          ) : null}
        </Box>
        <Text className="text-ice text-3xl font-semibold mb-4">
          {yearlyPriceLabel ?? t('plansPage.priceUnavailable')}
        </Text>
        {showPurchaseButtons ? (
          <>
            <Button
              className="w-full"
              disabled={!canPurchase || loadingInterval === 'year' || !yearlyPriceLabel}
              onPress={() => onPurchase('year')}
              testID="plans-purchase-yearly"
            >
              {loadingInterval === 'year' ? <ButtonSpinner color="#F1F5F9" /> : null}
              <ButtonText>{ctaLabel}</ButtonText>
            </Button>
            {helperText ? (
              <Text className="text-ice/60 text-xs text-center mt-2">{helperText}</Text>
            ) : null}
          </>
        ) : null}
      </Box>

      {!monthlyPriceLabel && !yearlyPriceLabel && showPurchaseButtons ? (
        <Box className="items-center py-2">
          <ActivityIndicator size="small" color="#6366F1" />
        </Box>
      ) : null}
    </Box>
  );
}
