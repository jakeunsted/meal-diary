import { defineStore } from 'pinia';
import type { User } from '../types/User'
import { useAuthStore } from './auth';
import { Preferences } from '@capacitor/preferences';

interface UserState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  lastFetchTime: number | null;
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    user: null,
    isLoading: false,
    error: null,
    lastFetchTime: null,
  }),

  getters: {
    getUser: (state) => state.user,
    getFullName: (state) => {
      if (!state.user) return '';
      return `${state.user.first_name || ''} ${state.user.last_name || ''}`.trim() || state.user.username;
    },
    getUsersFamilyGroup: (state) => {
      if (!state.user) return '';
      return state.user.family_group_id;
    },
    isAuthenticated: (state) => !!state.user,
  },

  actions: {
    async fetchUser(forceRefresh = false) {
      try {
        const authStore = useAuthStore();
        if (!authStore.user?.id) {
          throw new Error('No authenticated user found');
        }

        // Check if we have cached data and it's not too old (5 minutes)
        const now = Date.now();
        const cacheAge = this.lastFetchTime ? now - this.lastFetchTime : Infinity;
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

        if (!forceRefresh && this.user && cacheAge < CACHE_DURATION) {
          return this.user;
        }
        
        this.isLoading = true;
        this.error = null;
        const response = await $fetch<User>(`/api/user/${authStore.user.id}`);
        this.user = response;
        this.lastFetchTime = now;

        // Save to Preferences
        if (import.meta.client) {
          await Preferences.set({
            key: 'userData',
            value: JSON.stringify({
              user: response,
              lastFetchTime: now
            })
          });
        }

        return response;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch user';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async loadFromStorage() {
      if (import.meta.client) {
        try {
          const { value } = await Preferences.get({ key: 'userData' });
          if (value) {
            const { user, lastFetchTime } = JSON.parse(value);
            this.user = user;
            this.lastFetchTime = lastFetchTime;
            return true;
          }
        } catch (error) {
          console.error('Failed to load user data from storage:', error);
          await Preferences.remove({ key: 'userData' });
        }
      }
      return false;
    },

    async updateUser(userData: Partial<User>) {
      try {
        const authStore = useAuthStore();
        if (!authStore.user?.id) {
          throw new Error('No authenticated user found');
        }

        this.isLoading = true;
        this.error = null;
        const response = await $fetch<User>(`/api/user/${authStore.user.id}`, {
          method: 'PUT',
          body: userData,
        });
        this.user = response;
        this.lastFetchTime = Date.now();

        // Update storage
        if (import.meta.client) {
          await Preferences.set({
            key: 'userData',
            value: JSON.stringify({
              user: response,
              lastFetchTime: this.lastFetchTime
            })
          });
        }

        return response;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to update user';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async updateUserAvatar(avatarUrl: string) {
      return this.updateUser({ avatar_url: avatarUrl });
    },

    clearUser() {
      this.user = null;
      this.error = null;
      this.lastFetchTime = null;
      if (import.meta.client) {
        Preferences.remove({ key: 'userData' });
      }
    },
  },
});
