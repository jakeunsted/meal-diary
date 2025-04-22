import { defineStore } from 'pinia';
import type { User } from '~/types/User'
import { useAuthStore } from '~/stores/auth';

interface UserState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    user: null,
    isLoading: false,
    error: null,
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
    async fetchUser() {
      try {
        const authStore = useAuthStore();
        if (!authStore.user?.id) {
          throw new Error('No authenticated user found');
        }
        
        this.isLoading = true;
        this.error = null;
        const response = await $fetch<User>(`/api/user/${authStore.user.id}`);
        this.user = response;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch user';
      } finally {
        this.isLoading = false;
      }
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
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to update user';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    clearUser() {
      this.user = null;
      this.error = null;
    },
  },
});
