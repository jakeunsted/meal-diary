import { Linking, Platform } from 'react-native';
import type { Href } from 'expo-router';

import { env } from '@/constants/env';
import { isNativeBillingAvailable } from '@/lib/billing/purchases';

interface PlansRouter {
  push: (href: Href) => void;
}

export const openPlans = (router: PlansRouter): void => {
  if (Platform.OS !== 'web' && isNativeBillingAvailable()) {
    router.push('/(tabs)/profile/plans' as Href);
    return;
  }

  void Linking.openURL(`${env.webUrl}/plans`);
};

export const openWebPlans = (): void => {
  void Linking.openURL(`${env.webUrl}/plans`);
};

export const openWebManageBilling = (): void => {
  void Linking.openURL(`${env.webUrl}/profile`);
};
