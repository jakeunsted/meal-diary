import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { AnalyticsConsentChoice } from '@/lib/analytics/consentChoice';

export const PRODUCT_TOUR_SEEN_VALUE = 'seen';

export type ProductTourStepId = 'diary' | 'recipes' | 'shoppingList' | 'invite';

export type ProductTourHoleId =
  | 'diary-plan'
  | 'recipes-content'
  | 'shopping-list-content'
  | 'profile-invite'
  | 'profile-add-family-member';

export type ProductTourHref =
  | '/(tabs)/diary'
  | '/(tabs)/recipes'
  | '/(tabs)/shopping-list'
  | '/(tabs)/profile';

export interface ProductTourStep {
  id: ProductTourStepId;
  href: ProductTourHref;
  titleKey:
    | 'productTour.diary.title'
    | 'productTour.recipes.title'
    | 'productTour.shoppingList.title'
    | 'productTour.invite.title';
  bodyKey:
    | 'productTour.diary.body'
    | 'productTour.recipes.body'
    | 'productTour.shoppingList.body'
    | 'productTour.invite.body';
}

export const PRODUCT_TOUR_STEPS: ProductTourStep[] = [
  {
    id: 'diary',
    href: '/(tabs)/diary',
    titleKey: 'productTour.diary.title',
    bodyKey: 'productTour.diary.body',
  },
  {
    id: 'recipes',
    href: '/(tabs)/recipes',
    titleKey: 'productTour.recipes.title',
    bodyKey: 'productTour.recipes.body',
  },
  {
    id: 'shoppingList',
    href: '/(tabs)/shopping-list',
    titleKey: 'productTour.shoppingList.title',
    bodyKey: 'productTour.shoppingList.body',
  },
  {
    id: 'invite',
    href: '/(tabs)/profile',
    titleKey: 'productTour.invite.title',
    bodyKey: 'productTour.invite.body',
  },
];

const STEP_PRIMARY_HOLE: Record<Exclude<ProductTourStepId, 'invite'>, ProductTourHoleId> = {
  diary: 'diary-plan',
  recipes: 'recipes-content',
  shoppingList: 'shopping-list-content',
};

export function resolveTourTarget(
  stepId: ProductTourStepId,
  availableIds: readonly string[]
): ProductTourHoleId | null {
  if (stepId === 'invite') {
    if (availableIds.includes('profile-invite')) {
      return 'profile-invite';
    }
    if (availableIds.includes('profile-add-family-member')) {
      return 'profile-add-family-member';
    }
    return null;
  }

  const holeId = STEP_PRIMARY_HOLE[stepId];
  return availableIds.includes(holeId) ? holeId : null;
}

export type ProductTourStepAction = 'next' | 'back' | 'skip' | 'done';

export interface ProductTourStepActionResult {
  /** Next step index, or null when the tour should close. */
  nextIndex: number | null;
  writeSeen: boolean;
}

export function tourStepAfterAction(
  currentIndex: number,
  action: ProductTourStepAction,
  totalSteps: number = PRODUCT_TOUR_STEPS.length
): ProductTourStepActionResult {
  switch (action) {
    case 'skip':
    case 'done':
      return { nextIndex: null, writeSeen: true };
    case 'next': {
      if (currentIndex >= totalSteps - 1) {
        return { nextIndex: null, writeSeen: true };
      }
      return { nextIndex: currentIndex + 1, writeSeen: false };
    }
    case 'back': {
      if (currentIndex <= 0) {
        return { nextIndex: null, writeSeen: true };
      }
      return { nextIndex: currentIndex - 1, writeSeen: false };
    }
    default:
      return { nextIndex: currentIndex, writeSeen: false };
  }
}

export function productTourSeenStorageKey(userId: number | string): string {
  return `product_tour_seen:${userId}`;
}

export function parseProductTourSeen(value: string | null): boolean {
  return value === PRODUCT_TOUR_SEEN_VALUE;
}

export async function loadProductTourSeen(userId: number | string): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(productTourSeenStorageKey(userId));
    return parseProductTourSeen(value);
  } catch {
    // Treat read failures as not seen so the tour can still show.
    return false;
  }
}

export async function saveProductTourSeen(userId: number | string): Promise<void> {
  try {
    await AsyncStorage.setItem(productTourSeenStorageKey(userId), PRODUCT_TOUR_SEEN_VALUE);
  } catch {
    // Caller keeps an in-memory seen flag for this session.
  }
}

interface ProductTourReplaySnapshot {
  replayRequested: boolean;
}

let replaySnapshot: ProductTourReplaySnapshot = { replayRequested: false };
let tourVisible = false;
const replayListeners = new Set<() => void>();
const visibilityListeners = new Set<() => void>();

function publishReplay(next: ProductTourReplaySnapshot) {
  replaySnapshot = next;
  replayListeners.forEach((listener) => listener());
}

function publishVisibility() {
  visibilityListeners.forEach((listener) => listener());
}

export function getProductTourReplaySnapshot(): ProductTourReplaySnapshot {
  return replaySnapshot;
}

export function subscribeProductTourReplay(listener: () => void): () => void {
  replayListeners.add(listener);
  return () => {
    replayListeners.delete(listener);
  };
}

export function subscribeProductTourVisibility(listener: () => void): () => void {
  visibilityListeners.add(listener);
  return () => {
    visibilityListeners.delete(listener);
  };
}

/** Sync whether the tour overlay is currently visible (for replay no-op). */
export function setProductTourVisible(visible: boolean): void {
  if (tourVisible === visible) {
    return;
  }
  tourVisible = visible;
  publishVisibility();
}

export function isProductTourVisible(): boolean {
  return tourVisible;
}

export function useProductTourVisible(): boolean {
  return useSyncExternalStore(
    subscribeProductTourVisibility,
    isProductTourVisible,
    isProductTourVisible
  );
}

/**
 * Request a profile replay. No-ops if the tour is already open
 * or a replay is already pending.
 */
export function requestProductTourReplay(): void {
  if (tourVisible || replaySnapshot.replayRequested) {
    return;
  }
  publishReplay({ replayRequested: true });
}

export function clearProductTourReplay(): void {
  if (!replaySnapshot.replayRequested) {
    return;
  }
  publishReplay({ replayRequested: false });
}

export function useProductTourReplay(): boolean {
  return useSyncExternalStore(
    subscribeProductTourReplay,
    () => getProductTourReplaySnapshot().replayRequested,
    () => getProductTourReplaySnapshot().replayRequested
  );
}

export interface ShouldShowProductTourInput {
  hasFamily: boolean;
  consentLoaded: boolean;
  consentChoice: AnalyticsConsentChoice;
  seenLoaded: boolean;
  seen: boolean;
  replayRequested: boolean;
}

export function shouldShowProductTour(input: ShouldShowProductTourInput): boolean {
  if (!input.hasFamily) {
    return false;
  }
  if (!input.consentLoaded || input.consentChoice === null) {
    return false;
  }
  if (!input.seenLoaded) {
    return false;
  }
  if (input.replayRequested) {
    return true;
  }
  return !input.seen;
}
