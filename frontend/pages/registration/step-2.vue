<template>
  <div>
    <div class="flex justify-center items-center h-screen">
      <div class="card w-96 bg-base-200">
        <div class="card-body">
          <div class="card-title">
            <h1>{{ $t('Family Group') }}</h1>
          </div>
          <hr />
          
          <div class="tabs tabs-border mb-4 mx-auto">
            <button 
              class="tab" 
              data-testid="family-tab-create"
              :class="{ 'tab-active': activeTab === 'create' }"
              @click="activeTab = 'create'"
              :disabled="isLoading"
            >
              {{ $t('Create New') }}
            </button>
            <button 
              class="tab" 
              data-testid="family-tab-join"
              :class="{ 'tab-active': activeTab === 'join' }"
              @click="activeTab = 'join'"
              :disabled="isLoading"
            >
              {{ $t('Join Existing') }}
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <!-- Create New Family Group -->
            <div v-if="activeTab === 'create'" class="form-control">
              <label class="label mb-2">
                <span class="label-text">{{ $t('Family Group Name') }}</span>
              </label>
              <input 
                type="text" 
                v-model="familyName" 
                :placeholder="$t('Enter family group name')" 
                class="input input-bordered" 
                data-testid="family-create-name-input"
                :disabled="isLoading"
                required
              />
            </div>

            <!-- Join Existing Family Group -->
            <div v-if="activeTab === 'join'" class="form-control">
              <label class="label mb-2">
                <span class="label-text">{{ $t('Family group code') }}</span>
              </label>
              <input 
                type="text" 
                v-model="familyKey" 
                :placeholder="$t('Enter family group code')" 
                class="input input-bordered" 
                data-testid="family-join-key-input"
                :disabled="isLoading"
                required
              />
            </div>

            <button 
              type="submit" 
              class="btn btn-primary w-full mt-4"
              data-testid="family-submit-button"
              :disabled="isLoading"
            >
              <span v-if="isLoading" class="loading loading-spinner loading-sm"></span>
              <span v-else>{{ activeTab === 'create' ? $t('Create Family Group') : $t('Join Family Group') }}</span>
            </button>

            <div v-if="errorMessage" class="text-error text-center mt-2" data-testid="family-error-message">
              {{ errorMessage }}
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false,
  middleware: ['auth']
});

const activeTab = ref('create');
const familyName = ref('');
const familyKey = ref('');
const errorMessage = ref('');
const isLoading = ref(false);

const authStore = useAuthStore();
const userStore = useUserStore();
const { api } = useApi();
const { t } = useI18n();

const resolveJoinErrorMessage = (error) => {
  const entitlement = extractEntitlementError(error);

  if (entitlement?.feature === 'family_members') {
    return t('registrationStep2.familyGroupFull');
  }

  if (getHttpStatusCode(error) === 404) {
    return t('Family group not found');
  }

  return t('Failed to join family group, please try again!');
};

const handleSubmit = async () => {
  // Clear any existing error message
  errorMessage.value = '';
  isLoading.value = true;

  const user = authStore.user;

  try {
    if (activeTab.value === 'create') {
      try {
        const response = await api('/api/family-groups/create', {
          method: 'POST',
          body: { 
            name: familyName.value,
            created_by: user.id
          },
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });

        if (response) {
          // Refresh user data to get updated family_group_id
          const updatedUser = await userStore.fetchUser(true);
          if (updatedUser && authStore.accessToken && authStore.refreshToken) {
            // Update auth store with refreshed user data
            await authStore.setAuth({
              user: updatedUser,
              accessToken: authStore.accessToken,
              refreshToken: authStore.refreshToken
            });
          }
          navigateTo('/diary');
        }
      } catch (error) {
        console.error('Create error:', error);
        errorMessage.value = t('registrationStep2.createFailed');
      }
    } else {
      try {
        const response = await api('/api/family-groups/join', {
          method: 'POST',
          silent: true,
          body: { 
            random_identifier: familyKey.value,
            user_id: user.id
          },
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'x-refresh-token': authStore.refreshToken || ''
          }
        });

        if (response) {
          // Refresh user data to get updated family_group_id
          const updatedUser = await userStore.fetchUser(true);
          if (updatedUser && authStore.accessToken && authStore.refreshToken) {
            // Update auth store with refreshed user data
            await authStore.setAuth({
              user: updatedUser,
              accessToken: authStore.accessToken,
              refreshToken: authStore.refreshToken
            });
          }
          navigateTo('/diary');
        }
      } catch (error) {
        console.error('Join error:', error);
        errorMessage.value = resolveJoinErrorMessage(error);
      }
    }
  } catch (error) {
    console.error('Error:', error);
    errorMessage.value = t('registrationStep2.genericError');
  } finally {
    isLoading.value = false;
  }
};
</script>
