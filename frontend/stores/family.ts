import { defineStore } from 'pinia';
import { Preferences } from '@capacitor/preferences';
import type { FamilyMember, DisplayMember, FamilyGroup } from '~/types/FamilyGroup';
import type { ApiResponse } from '~/types/Api';

const CACHE_NAME = 'avatar-cache-v1';

async function cacheAvatar(url: string): Promise<string> {
  try {
    // Check if the image is already in cache
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);
    
    if (cachedResponse) {
      return URL.createObjectURL(await cachedResponse.blob());
    }

    // If not in cache, fetch and cache it
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch avatar');
    
    await cache.put(url, response.clone());
    return URL.createObjectURL(await response.blob());
  } catch (error) {
    console.error('Error caching avatar:', error);
    return url; // Return original URL if caching fails
  }
}

export const useFamilyStore = defineStore('family', {
  state: () => ({
    familyGroup: null as FamilyGroup | null,
    members: [] as DisplayMember[],
    isLoading: false,
    error: null as string | null,
    groupLastFetched: null as string | null,
    membersLastFetched: null as string | null,
  }),

  actions: {
    async fetchMembers() {
      const userStore = useUserStore();
      const authStore = useAuthStore();

      if (!userStore.user?.family_group_id) return;
      
      // Check if we have cached data that's less than 5 minutes old
      const cachedData = await Preferences.get({ key: 'family_members' });
      const lastFetched = await Preferences.get({ key: 'family_members_last_fetched' });
      
      if (cachedData.value && lastFetched.value) {
        const lastFetchTime = new Date(lastFetched.value).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        
        if (lastFetchTime > fiveMinutesAgo) {
          this.members = JSON.parse(cachedData.value);
          return;
        }
      }

      this.isLoading = true;
      this.error = null;
      
      try {
        const response = await $fetch<ApiResponse<FamilyMember[]>>(`/api/family-groups/${userStore.user.family_group_id}/members`, {
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });

        // Check for new tokens in response headers
        const newAccessToken = response.headers['x-new-access-token'];
        const newRefreshToken = response.headers['x-new-refresh-token'];
        
        if (newAccessToken && newRefreshToken && authStore.user) {
          authStore.setAuth({
            user: authStore.user,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
          });
        }

        // Process members and cache their avatars
        const filteredMembers = await Promise.all(
          response.data
            .filter((member: FamilyMember) => member.id !== userStore.user?.id)
            .map(async (member: FamilyMember) => {
              const avatarUrl = member.avatar_url || '/temp-avatars/generic-avatar.png';
              const cachedUrl = await cacheAvatar(avatarUrl);
              return {
                id: member.id,
                name: member.username,
                avatar_url: cachedUrl,
              };
            })
        );

        this.members = filteredMembers;
        this.membersLastFetched = new Date().toISOString();

        // Cache the data
        await Preferences.set({ 
          key: 'family_members', 
          value: JSON.stringify(filteredMembers) 
        });
        await Preferences.set({ 
          key: 'family_members_last_fetched', 
          value: this.membersLastFetched 
        });
      } catch (err: unknown) {
        // Try to load from cache if available
        if (cachedData.value) {
          this.members = JSON.parse(cachedData.value);
          this.error = 'Using cached data - unable to fetch latest family members';
        } else {
          this.error = err instanceof Error ? err.message : 'Failed to fetch family members';
        }
        throw err; // Re-throw to let the component handle it
      } finally {
        this.isLoading = false;
      }
    },

    async fetchFamilyGroup() {
      const userStore = useUserStore();
      const authStore = useAuthStore();

      if (!userStore.user?.family_group_id) return;

      // Check if we have cached data that's less than 5 minutes old
      const cachedData = await Preferences.get({ key: 'family_group' });
      const lastFetched = await Preferences.get({ key: 'family_group_last_fetched' });
      
      if (cachedData.value && lastFetched.value) {
        const lastFetchTime = new Date(lastFetched.value).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        
        if (lastFetchTime > fiveMinutesAgo) {
          this.familyGroup = JSON.parse(cachedData.value);
          return;
        }
      }

      this.isLoading = true;
      this.error = null;

      try {
        const response = await $fetch<ApiResponse<FamilyGroup>>(`/api/family-groups/${userStore.user.family_group_id}`, {
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });

        this.familyGroup = response.data;
        this.groupLastFetched = new Date().toISOString();

        // Cache the data
        await Preferences.set({ 
          key: 'family_group', 
          value: JSON.stringify(response.data) 
        });
        await Preferences.set({
          key: 'family_group_last_fetched',
          value: this.groupLastFetched
        });
      } catch (err: unknown) {
        // Try to load from cache if available
        if (cachedData.value) {
          this.familyGroup = JSON.parse(cachedData.value);
          this.error = 'Using cached data - unable to fetch latest family group';
        } else {
          this.error = err instanceof Error ? err.message : 'Failed to fetch family group';
        }
        throw err; // Re-throw to let the component handle it
      } finally {
        this.isLoading = false;
      }
    },

    clearCache() {
      Preferences.remove({ key: 'family_members' });
      Preferences.remove({ key: 'family_members_last_fetched' });
      Preferences.remove({ key: 'family_group' });
      Preferences.remove({ key: 'family_group_last_fetched' });
      this.members = [];
      this.membersLastFetched = null;
      this.groupLastFetched = null;
    }
  }
}); 