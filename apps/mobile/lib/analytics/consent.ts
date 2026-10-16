import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { parseAnalyticsConsent, type AnalyticsConsentChoice } from '@/lib/analytics/consentChoice';
import {
  identifyUser,
  revokeAnalyticsCapture,
  syncAnalyticsCapture,
} from '@/lib/analytics/posthog';
import { useAuthStore } from '@/lib/auth/authStore';

const STORAGE_KEY = 'analytics_consent';

export interface AnalyticsConsentSnapshot {
  loaded: boolean;
  choice: AnalyticsConsentChoice;
}

let snapshot: AnalyticsConsentSnapshot = { loaded: false, choice: null };
const listeners = new Set<() => void>();
let loadPromise: Promise<void> | null = null;

function publish(next: AnalyticsConsentSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

async function persistChoice(choice: Exclude<AnalyticsConsentChoice, null>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // In-memory choice still applies this session.
  }
}

function identifySignedInUser(): void {
  const user = useAuthStore.getState().user;
  if (user) {
    identifyUser(user);
  }
}

export function loadAnalyticsConsent(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      let choice: AnalyticsConsentChoice = null;
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        choice = parseAnalyticsConsent(value);
      } catch {
        choice = null;
      }

      await syncAnalyticsCapture(choice);
      publish({ loaded: true, choice });
      if (choice === 'granted') {
        identifySignedInUser();
      }
    })();
  }

  return loadPromise;
}

export function getAnalyticsConsentSnapshot(): AnalyticsConsentSnapshot {
  return snapshot;
}

export function subscribeAnalyticsConsent(listener: () => void): () => void {
  listeners.add(listener);
  void loadAnalyticsConsent();
  return () => {
    listeners.delete(listener);
  };
}

export async function grantAnalyticsConsent(): Promise<void> {
  await persistChoice('granted');
  publish({ loaded: true, choice: 'granted' });
  await syncAnalyticsCapture('granted');
  identifySignedInUser();
}

export async function denyAnalyticsConsent(): Promise<void> {
  await persistChoice('denied');
  publish({ loaded: true, choice: 'denied' });
  await revokeAnalyticsCapture();
}

export function useAnalyticsConsent(): AnalyticsConsentSnapshot & {
  grant: () => Promise<void>;
  deny: () => Promise<void>;
} {
  const current = useSyncExternalStore(
    subscribeAnalyticsConsent,
    getAnalyticsConsentSnapshot,
    getAnalyticsConsentSnapshot
  );

  return {
    loaded: current.loaded,
    choice: current.choice,
    grant: grantAnalyticsConsent,
    deny: denyAnalyticsConsent,
  };
}
