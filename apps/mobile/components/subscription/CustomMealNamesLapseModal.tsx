import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import {
  customMealNamesRenewRoute,
  shouldShowCustomMealNamesLapse,
} from '@/lib/billing/customMealNamesLapse';
import { openWebPlans } from '@/lib/billing/openPlans';
import { isNativeBillingAvailable } from '@/lib/billing/purchases';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { entitlementKeys, useCurrentUser, useEntitlements } from '@/lib/queries/profile';
import type { ResolvedEntitlements } from '@/types/api';

interface CustomMealNamesLapseModalProps {
  dismissedThisVisit: boolean;
  onDismissVisit: () => void;
}

function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function CustomMealNamesLapseModal({
  dismissedThisVisit,
  onDismissVisit,
}: CustomMealNamesLapseModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const paywallOpen = usePaywallStore((state) => state.activeFeature != null);
  const userQuery = useCurrentUser();
  const familyGroupId = userQuery.data?.family_group_id;
  const entitlementsQuery = useEntitlements(familyGroupId);
  const [resetFailed, setResetFailed] = useState(false);

  const entitlements = entitlementsQuery.isSuccess ? entitlementsQuery.data : undefined;
  const isOwner = entitlements?.billing.isOwner ?? false;
  const plansScreenOpen = pathname === '/profile/plans' || pathname.endsWith('/plans');
  const visible = shouldShowCustomMealNamesLapse({
    prompt: entitlements?.prompts.customMealNamesLapse,
    entitlementsReady: entitlementsQuery.isSuccess,
    paywallOpen,
    plansScreenOpen,
    dismissedThisVisit,
  });

  const resetMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<ResolvedEntitlements>(
        `/family-groups/${id}/meal-slots/reset-to-defaults`,
        {
          method: 'POST',
          body: { today: localToday() },
        }
      ),
    onSuccess: async (nextEntitlements, id) => {
      queryClient.setQueryData(entitlementKeys.family(id), nextEntitlements);
      await useAuthStore.getState().setEntitlements(nextEntitlements);
      setResetFailed(false);
    },
    onError: () => {
      setResetFailed(true);
    },
  });

  const scheduleReset = () => {
    if (resetMutation.isPending) {
      return;
    }
    if (!familyGroupId) {
      setResetFailed(true);
      return;
    }
    setResetFailed(false);
    resetMutation.mutate(familyGroupId);
  };

  const handleClose = () => {
    if (resetMutation.isPending) {
      return;
    }
    if (!isOwner) {
      onDismissVisit();
      return;
    }
    scheduleReset();
  };

  const handleRenew = () => {
    if (resetMutation.isPending || !entitlements) {
      return;
    }
    const route = customMealNamesRenewRoute({
      isOwner: entitlements.billing.isOwner,
      storePlatform: entitlements.billing.storePlatform,
      nativeBillingAvailable: isNativeBillingAvailable(),
    });
    if (route === 'web') {
      openWebPlans();
      return;
    }
    if (route === 'plans') {
      router.push('/(tabs)/profile/plans' as Href);
    }
  };

  if (!visible || !entitlements) {
    return null;
  }

  const ownerName = entitlements.billing.ownerDisplayName?.trim() || null;
  const title = isOwner
    ? t('paywall.customMealNamesLapse.ownerTitle')
    : t('paywall.customMealNamesLapse.nonOwnerTitle');
  const description = isOwner
    ? t('paywall.customMealNamesLapse.ownerDescription')
    : ownerName
      ? t('paywall.customMealNamesLapse.nonOwnerDescription', { name: ownerName })
      : t('paywall.customMealNamesLapse.nonOwnerDescriptionGeneric');
  const isResetting = resetMutation.isPending;

  return (
    <DialogModal visible onClose={handleClose} testID="custom-meal-names-lapse-modal">
      <DialogPanel>
        <Heading size="lg" className="text-ice mb-3">
          {title}
        </Heading>
        <Text className="text-ice/70 mb-6">{description}</Text>
        {resetFailed ? (
          <Text className="text-red-400 mb-4 text-sm" testID="custom-meal-names-lapse-error">
            {t('paywall.customMealNamesLapse.error')}
          </Text>
        ) : null}

        <Box className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onPress={handleClose}
            disabled={isResetting}
            testID="custom-meal-names-lapse-not-now"
          >
            {isResetting ? <ButtonSpinner color="#F1F5F9" /> : null}
            <ButtonText>{t('paywall.customMealNamesLapse.notNow')}</ButtonText>
          </Button>
          {isOwner ? (
            <Button
              onPress={handleRenew}
              disabled={isResetting}
              testID="custom-meal-names-lapse-renew"
            >
              <ButtonText>{t('paywall.customMealNamesLapse.renew')}</ButtonText>
            </Button>
          ) : null}
        </Box>
      </DialogPanel>
    </DialogModal>
  );
}
