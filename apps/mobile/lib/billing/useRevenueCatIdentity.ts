import { useEffect, useRef } from 'react';

import { logWarn } from '@/lib/analytics/posthog';
import { apiFetch } from '@/lib/api/client';
import { queryClient } from '@/lib/api/queryClient';
import { useAuthStore } from '@/lib/auth/authStore';
import { linkRevenueCatUser } from '@/lib/billing/linkRevenueCat';
import {
  configurePurchases,
  isNativeBillingAvailable,
  logOutPurchases,
  subscribeToCustomerInfoUpdates,
} from '@/lib/billing/purchases';
import { entitlementKeys, useEntitlements } from '@/lib/queries/profile';
import type { ResolvedEntitlements } from '@/types/api';

/**
 * Configures RevenueCat and links the family owner identity for store purchases.
 * Non-owners skip linking (only owners can manage billing).
 */
export function useRevenueCatIdentity() {
  const status = useAuthStore((state) => state.status);
  const familyGroupId = useAuthStore((state) => state.user?.family_group_id);
  const entitlementsQuery = useEntitlements(
    status === 'signedIn' ? familyGroupId ?? undefined : undefined
  );
  const isOwner = entitlementsQuery.data?.billing.isOwner ?? false;
  const linkedFamilyGroupIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isNativeBillingAvailable()) {
      return;
    }

    void configurePurchases();
  }, []);

  useEffect(() => {
    if (!isNativeBillingAvailable()) {
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const ready = await configurePurchases();
      if (!ready || cancelled) {
        return;
      }

      unsubscribe = subscribeToCustomerInfoUpdates(() => {
        void queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!isNativeBillingAvailable()) {
      return;
    }

    if (status !== 'signedIn' || !familyGroupId || !isOwner) {
      if (linkedFamilyGroupIdRef.current !== null) {
        linkedFamilyGroupIdRef.current = null;
        void logOutPurchases();
      }
      return;
    }

    if (linkedFamilyGroupIdRef.current === familyGroupId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await linkRevenueCatUser(familyGroupId);
        if (cancelled) {
          return;
        }
        linkedFamilyGroupIdRef.current = familyGroupId;

        try {
          const synced = await apiFetch<ResolvedEntitlements>('/billing/sync-revenuecat', {
            method: 'POST',
            body: { family_group_id: familyGroupId },
          });
          if (cancelled) {
            return;
          }
          queryClient.setQueryData(entitlementKeys.family(familyGroupId), synced);
          await useAuthStore.getState().setEntitlements(synced);
        } catch (error) {
          console.warn('[RevenueCat] subscription sync failed', error);
          void queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
        }
      } catch (error) {
        console.warn('[RevenueCat] identity link failed', error);
        logWarn('RevenueCat identity link failed', { category: 'billing' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, familyGroupId, isOwner]);
}
