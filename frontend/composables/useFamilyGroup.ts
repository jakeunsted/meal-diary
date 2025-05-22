import { ref } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useUserStore } from '~/stores/user';
import type { FamilyMember, DisplayMember } from '~/types/FamilyGroup';
import type { ApiResponse } from '~/types/Api';

export default function useFamilyGroup() {
  const familyMembers = ref<DisplayMember[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const fetchFamilyMembers = async () => {
    const userStore = useUserStore();
    const authStore = useAuthStore();

    if (!userStore.user?.family_group_id) return;
    
    isLoading.value = true;
    error.value = null;
    
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

      familyMembers.value = response.data.map((member: FamilyMember) => ({
        id: member.id,
        name: member.username,
        avatar: '/temp-avatars/avataaars' + (member.id % 3 + 1) + '.png', // Temporary avatar assignment
      }));
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch family members';
    } finally {
      isLoading.value = false;
    }
  };

  return {
    familyMembers,
    isLoading,
    error,
    fetchFamilyMembers
  };
}
