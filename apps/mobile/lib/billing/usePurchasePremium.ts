import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PurchasesPackage } from 'react-native-purchases';

import { apiFetch } from '@/lib/api/client';
import { linkRevenueCatUser } from '@/lib/billing/linkRevenueCat';
import {
  getOfferingPackages,
  purchasePackage,
  restorePurchases,
  type BillingInterval,
  type OfferingPackages,
} from '@/lib/billing/purchases';
import type { ResolvedEntitlements } from '@/types/api';

const POLL_ATTEMPTS = 8;
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

  const refreshEntitlementsUntilPremium = useCallback(async (): Promise<ResolvedEntitlements | null> => {
    if (!familyGroupId) {
      return null;
    }

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      const entitlements = await queryClient.fetchQuery({
        queryKey: ['entitlements', familyGroupId],
        queryFn: () =>
          apiFetch<ResolvedEntitlements>(`/family-groups/${familyGroupId}/entitlements`),
      });

      if (entitlements.plan === 'premium') {
        return entitlements;
      }

      if (attempt < POLL_ATTEMPTS - 1) {
        await wait(POLL_DELAY_MS);
      }
    }

    return (
      (queryClient.getQueryData(['entitlements', familyGroupId]) as ResolvedEntitlements | undefined) ??
      null
    );
  }, [familyGroupId, queryClient]);

  const loadOfferings = useCallback(async () => {
    setIsLoadingOfferings(true);
    setError(null);
    try {
      const next = await getOfferingPackages();
      setOfferings(next);
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load plans';
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
        const message = err instanceof Error ? err.message : 'Purchase failed';
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
      const message = err instanceof Error ? err.message : 'Restore failed';
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
