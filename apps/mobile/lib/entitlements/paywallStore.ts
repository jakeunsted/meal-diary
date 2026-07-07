import type { EntitlementFeature } from '@meal-diary/shared';
import { create } from 'zustand';

interface PaywallState {
  activeFeature: EntitlementFeature | null;
  openPaywall: (feature: EntitlementFeature) => void;
  closePaywall: () => void;
}

export const usePaywallStore = create<PaywallState>((set) => ({
  activeFeature: null,
  openPaywall: (feature) => set({ activeFeature: feature }),
  closePaywall: () => set({ activeFeature: null }),
}));
