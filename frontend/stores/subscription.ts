import { defineStore } from 'pinia';
import { browserStorage } from '~/utils/browserStorage';
import type { ResolvedEntitlements } from '~/types/Entitlements';

const ENTITLEMENTS_KEY = 'entitlements';
const ENTITLEMENTS_FETCHED_KEY = 'entitlements_last_fetched';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface SubscriptionState {
  entitlements: ResolvedEntitlements | null;
  loading: boolean;
  error: string | null;
}

export const useSubscriptionStore = defineStore('subscription', {
  state: (): SubscriptionState => ({
    entitlements: null,
    loading: false,
    error: null,
  }),

  getters: {
    isPremium: (state) => state.entitlements?.plan === 'premium',
    currentPlan: (state) => state.entitlements?.plan ?? 'free',
  },

  actions: {
    setEntitlements(entitlements: ResolvedEntitlements | null) {
      this.entitlements = entitlements;
      if (import.meta.client) {
        if (entitlements) {
          browserStorage.set(ENTITLEMENTS_KEY, JSON.stringify(entitlements));
          browserStorage.set(ENTITLEMENTS_FETCHED_KEY, String(Date.now()));
        } else {
          browserStorage.remove(ENTITLEMENTS_KEY);
          browserStorage.remove(ENTITLEMENTS_FETCHED_KEY);
        }
      }
    },

    async hydrateFromStorage() {
      if (!import.meta.client) return;

      const value = browserStorage.get(ENTITLEMENTS_KEY);
      const fetchedAt = browserStorage.get(ENTITLEMENTS_FETCHED_KEY);

      if (!value || !fetchedAt) return;

      const age = Date.now() - Number(fetchedAt);
      if (age > CACHE_TTL_MS) return;

      try {
        this.entitlements = JSON.parse(value) as ResolvedEntitlements;
      } catch {
        browserStorage.remove(ENTITLEMENTS_KEY);
      }
    },

    async fetchEntitlements(familyGroupId: number, force = false) {
      const userStore = useUserStore();

      if (!force && this.entitlements) {
        const fetchedAt = browserStorage.get(ENTITLEMENTS_FETCHED_KEY);
        if (fetchedAt && Date.now() - Number(fetchedAt) < CACHE_TTL_MS) {
          return this.entitlements;
        }
      }

      try {
        this.loading = true;
        this.error = null;
        const { api } = useApi();
        const response = await api<ResolvedEntitlements>(
          `/api/family-groups/${familyGroupId}/entitlements`
        );
        this.setEntitlements(response);
        return response;
      } catch (error) {
        console.error('Error fetching entitlements:', error);
        this.error = 'Failed to load subscription details';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    clearCache() {
      this.entitlements = null;
      this.error = null;
      if (import.meta.client) {
        browserStorage.remove(ENTITLEMENTS_KEY);
        browserStorage.remove(ENTITLEMENTS_FETCHED_KEY);
      }
    },
  },
});
