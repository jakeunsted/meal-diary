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
              :class="{ 'tab-active': activeTab === 'create' }"
              @click="activeTab = 'create'"
            >
              {{ $t('Create New') }}
            </button>
            <button 
              class="tab" 
              :class="{ 'tab-active': activeTab === 'join' }"
              @click="activeTab = 'join'"
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
                required
              />
            </div>

            <!-- Join Existing Family Group -->
            <div v-if="activeTab === 'join'" class="form-control">
              <label class="label mb-2">
                <span class="label-text">{{ $t('Family Key') }}</span>
              </label>
              <input 
                type="text" 
                v-model="familyKey" 
                :placeholder="$t('Enter family key')" 
                class="input input-bordered" 
                required
              />
            </div>

            <button type="submit" class="btn btn-primary w-full mt-4">
              {{ activeTab === 'create' ? $t('Create Family Group') : $t('Join Family Group') }}
            </button>

            <div v-if="errorMessage" class="text-error text-center mt-2">
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

const authStore = useAuthStore();

const handleSubmit = async () => {
  // Clear any existing error message
  errorMessage.value = '';

  const user = authStore.user;

  try {
    if (activeTab.value === 'create') {
      try {
        const response = await $fetch('/api/family-groups/create', {
          method: 'POST',
          body: { 
            name: familyName.value,
            created_by: user.id
          },
        });

        if (response) {
          navigateTo('/diary');
        }
      } catch (error) {
        console.error('Create error:', error);
        errorMessage.value = 'Failed to create family group, please try again!';
      }
    } else {
      try {
        const response = await $fetch('/api/family-groups/join', {
          method: 'POST',
          body: { 
            random_identifier: familyKey.value,
            user_id: user.id
          },
        });

        if (response) {
          navigateTo('/diary');
        }
      } catch (error) {
        console.error('Join error:', error);
        if (error.statusCode === 404) {
          errorMessage.value = 'Family group not found';
        } else {
          errorMessage.value = 'Failed to join family group, please try again!';
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
    errorMessage.value = 'An error occurred';
  }
};
</script>
