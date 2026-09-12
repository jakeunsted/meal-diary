import { useEffect, useRef } from 'react';

import { linkRevenueCatUser } from '@/lib/billing/linkRevenueCat';
import {
  configurePurchases,
  isNativeBillingAvailable,
  logOutPurchases,
} from '@/lib/billing/purchases';
import { useAuthStore } from '@/lib/auth/authStore';
import { useEntitlements } from '@/lib/queries/profile';

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
        if (!cancelled) {
          linkedFamilyGroupIdRef.current = familyGroupId;
        }
      } catch (error) {
        console.warn('[RevenueCat] identity link failed', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, familyGroupId, isOwner]);
}
