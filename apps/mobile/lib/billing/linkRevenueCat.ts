import { apiFetch } from '@/lib/api/client';
import { logInPurchases } from '@/lib/billing/purchases';

interface LinkRevenueCatResponse {
  app_user_id: string;
}

export const linkRevenueCatUser = async (familyGroupId: number): Promise<string> => {
  const response = await apiFetch<LinkRevenueCatResponse>('/billing/link-revenuecat', {
    method: 'POST',
    body: { family_group_id: familyGroupId },
  });

  await logInPurchases(response.app_user_id);
  return response.app_user_id;
};
