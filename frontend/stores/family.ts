import { defineStore } from 'pinia';
import { browserStorage } from '~/utils/browserStorage';
import type { FamilyMember, DisplayMember, FamilyGroup } from '~/types/FamilyGroup';
import type { ApiResponse } from '~/types/Api';
import { useApi } from '~/composables/useApi';
import { useUserStore } from '~/stores/user';

const CACHE_NAME = 'avatar-cache-v1';

async function cacheAvatar(url: string): Promise<string> {
  try {
    // If it's a generic avatar or a relative path, return it as is
    if (url.startsWith('/temp-avatars/') || url.startsWith('/')) {
      return url;
    }

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

      if (!userStore.user?.family_group_id) return;
      
      // Check if we have cached data that's less than 5 minutes old
      const cachedData = browserStorage.get('family_members');
      const lastFetched = browserStorage.get('family_members_last_fetched');
      
      if (cachedData && lastFetched) {
        const lastFetchTime = new Date(lastFetched).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        
        if (lastFetchTime > fiveMinutesAgo) {
          this.members = JSON.parse(cachedData);
          return;
        }
      }

      this.isLoading = true;
      this.error = null;
      
      try {
        const { api } = useApi();
        const response = await api<ApiResponse<FamilyMember[]>>(`/api/family-groups/${userStore.user.family_group_id}/members`);

        // Process members and cache their avatars
        const filteredMembers = await Promise.all(
          response.data
            .filter((member: FamilyMember) => member.id !== userStore.user?.id)
            .map(async (member: FamilyMember) => {
              try {
                // If no avatar_url, use generic avatar directly
                if (!member.avatar_url) {
                  return {
                    id: member.id,
                    name: member.username,
                    avatar_url: '/temp-avatars/generic-avatar.png',
                  };
                }
                // Only try to cache if there's an actual avatar_url
                const cachedUrl = await cacheAvatar(member.avatar_url);
                return {
                  id: member.id,
                  name: member.username,
                  avatar_url: cachedUrl,
                };
              } catch (e) {
                console.error('Error processing member avatar:', e);
                return {
                  id: member.id,
                  name: member.username,
                  avatar_url: '/temp-avatars/generic-avatar.png',
                };
              }
            })
        );

        this.members = filteredMembers;
        const membersLastFetched = new Date().toISOString();
        this.membersLastFetched = membersLastFetched;

        // Cache the data
        browserStorage.set('family_members', JSON.stringify(filteredMembers));
        browserStorage.set('family_members_last_fetched', membersLastFetched);
      } catch (err: unknown) {
        // Try to load from cache if available
        if (cachedData) {
          this.members = JSON.parse(cachedData);
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

      if (!userStore.user?.family_group_id) return;

      // Check if we have cached data that's less than 5 minutes old
      const cachedData = browserStorage.get('family_group');
      const lastFetched = browserStorage.get('family_group_last_fetched');
      
      if (cachedData && lastFetched) {
        const lastFetchTime = new Date(lastFetched).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        
        if (lastFetchTime > fiveMinutesAgo) {
          this.familyGroup = JSON.parse(cachedData);
          return;
        }
      }

      this.isLoading = true;
      this.error = null;

      try {
        const { api } = useApi();
        const response = await api<ApiResponse<FamilyGroup>>(`/api/family-groups/${userStore.user.family_group_id}`);

        this.familyGroup = response.data;
        const groupLastFetched = new Date().toISOString();
        this.groupLastFetched = groupLastFetched;

        // Cache the data
        browserStorage.set('family_group', JSON.stringify(response.data));
        browserStorage.set('family_group_last_fetched', groupLastFetched);
      } catch (err: unknown) {
        // Try to load from cache if available
        if (cachedData) {
          this.familyGroup = JSON.parse(cachedData);
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
      browserStorage.remove('family_members');
      browserStorage.remove('family_members_last_fetched');
      browserStorage.remove('family_group');
      browserStorage.remove('family_group_last_fetched');
      this.members = [];
      this.membersLastFetched = null;
      this.groupLastFetched = null;
    }
  }
}); 