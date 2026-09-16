import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PurchasesPackage } from 'react-native-purchases';

import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import { linkRevenueCatUser } from '@/lib/billing/linkRevenueCat';
import {
  formatPurchasesError,
  getOfferingPackages,
  purchasePackage,
  restorePurchases,
  type BillingInterval,
  type OfferingPackages,
} from '@/lib/billing/purchases';
import { logWarn } from '@/lib/analytics/posthog';
import { entitlementKeys, fetchEntitlements } from '@/lib/queries/profile';
import type { ResolvedEntitlements } from '@/types/api';

const POLL_ATTEMPTS = 12;
const POLL_DELAY_MS = 1500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function usePurchasePremium(familyGroupId: number | undefined) {
  const queryClient = useQueryClient();
  const [isPurchasing, setIsPurchasing] = useState<BillingInterval | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(false);
  const [offerings, setOfferings] = useState<OfferingPackages>({
    monthly: null,
    yearly: null,
  });
  const [error, setError] = useState<string | null>(null);

  const applyEntitlements = useCallback(
    async (entitlements: ResolvedEntitlements): Promise<ResolvedEntitlements> => {
      if (familyGroupId) {
        queryClient.setQueryData(entitlementKeys.family(familyGroupId), entitlements);
        await useAuthStore.getState().setEntitlements(entitlements);
      }
      return entitlements;
    },
    [familyGroupId, queryClient]
  );

  const refreshEntitlementsUntilPremium = useCallback(async (): Promise<ResolvedEntitlements | null> => {
    if (!familyGroupId) {
      return null;
    }

    const loadEntitlements = async (): Promise<ResolvedEntitlements> => {
      const entitlements = await queryClient.fetchQuery({
        queryKey: entitlementKeys.family(familyGroupId),
        queryFn: () => fetchEntitlements(familyGroupId),
        staleTime: 0,
      });
      await applyEntitlements(entitlements);
      return entitlements;
    };

    let entitlements = await loadEntitlements();
    if (entitlements.plan === 'premium') {
      return entitlements;
    }

    try {
      const synced = await apiFetch<ResolvedEntitlements>('/billing/sync-revenuecat', {
        method: 'POST',
        body: { family_group_id: familyGroupId },
      });
      entitlements = await applyEntitlements(synced);
      if (entitlements.plan === 'premium') {
        return entitlements;
      }
    } catch (err) {
      logWarn('RevenueCat subscription sync failed', {
        category: 'billing',
        message: err instanceof Error ? err.message : 'sync failed',
      });
    }

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      entitlements = await loadEntitlements();
      if (entitlements.plan === 'premium') {
        return entitlements;
      }

      if (attempt < POLL_ATTEMPTS - 1) {
        await wait(POLL_DELAY_MS);
      }
    }

    return entitlements;
  }, [applyEntitlements, familyGroupId, queryClient]);

  const loadOfferings = useCallback(async () => {
    setIsLoadingOfferings(true);
    setError(null);
    try {
      const next = await getOfferingPackages();
      setOfferings(next);
      return next;
    } catch (err) {
      const message = formatPurchasesError(err);
      logWarn('RevenueCat offerings failed', { category: 'billing', message });
      setError(message);
      return { monthly: null, yearly: null };
    } finally {
      setIsLoadingOfferings(false);
    }
  }, []);

  const ensureLinked = useCallback(async () => {
    if (!familyGroupId) {
      throw new Error('Family group is required');
    }
    await linkRevenueCatUser(familyGroupId);
  }, [familyGroupId]);

  const purchaseInterval = useCallback(
    async (interval: BillingInterval): Promise<'purchased' | 'cancelled' | 'failed'> => {
      if (!familyGroupId) {
        setError('Family group is required');
        return 'failed';
      }

      setIsPurchasing(interval);
      setError(null);

      try {
        await ensureLinked();

        let packages = offerings;
        if ((interval === 'month' && !packages.monthly) || (interval === 'year' && !packages.yearly)) {
          packages = await loadOfferings();
        }

        const pkg: PurchasesPackage | null =
          interval === 'month' ? packages.monthly : packages.yearly;

        if (!pkg) {
          setError('This plan is not available right now. Please try again later.');
          return 'failed';
        }

        const result = await purchasePackage(pkg);
        if (result === 'cancelled') {
          return 'cancelled';
        }

        await refreshEntitlementsUntilPremium();
        return 'purchased';
      } catch (err) {
        const message = formatPurchasesError(err);
        logWarn('RevenueCat purchase failed', { category: 'billing', message });
        setError(message);
        return 'failed';
      } finally {
        setIsPurchasing(null);
      }
    },
    [
      ensureLinked,
      familyGroupId,
      loadOfferings,
      offerings,
      refreshEntitlementsUntilPremium,
    ]
  );

  const restore = useCallback(async (): Promise<'restored' | 'failed'> => {
    if (!familyGroupId) {
      setError('Family group is required');
      return 'failed';
    }

    setIsRestoring(true);
    setError(null);

    try {
      await ensureLinked();
      await restorePurchases();
      await refreshEntitlementsUntilPremium();
      return 'restored';
    } catch (err) {
      const message = formatPurchasesError(err);
      logWarn('RevenueCat restore failed', { category: 'billing', message });
      setError(message);
      return 'failed';
    } finally {
      setIsRestoring(false);
    }
  }, [ensureLinked, familyGroupId, refreshEntitlementsUntilPremium]);

  return {
    offerings,
    error,
    setError,
    isPurchasing,
    isRestoring,
    isLoadingOfferings,
    loadOfferings,
    purchaseInterval,
    restore,
    refreshEntitlementsUntilPremium,
  };
}
