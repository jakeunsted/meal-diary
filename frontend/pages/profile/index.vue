<template>
  <div>
    <div class="mt-4">
      <div v-if="userStore.isLoading" class="flex justify-center">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
      <div v-else-if="userStore.error" class="alert alert-error mx-4">
        {{ userStore.error }}
      </div>
      <div v-else-if="userStore.user" class="avatar flex justify-center">
        <div class="mask mask-squircle w-24">
          <img :src="'/temp-avatars/avataaars1.png'" />
        </div>
      </div>
      <h2 class="text-center font-bold">{{ userStore.getFullName }}</h2>

      <div class="divider mx-4"></div>

      <div class="card bg-base-200 m-4 shadow-sm ">
        <div class="card-title px-6 my-2">
          <h2 class="font-bold">{{ $t('Your family members') }}</h2>
        </div>
        <div class="bg-base-300 rounded-b-lg pb-6">
          <div class="card-body">
            <div class="flex flex-col gap-4">
              <div class="flex flex-row gap-4">
                <div v-for="member in familyMembers" :key="member.name">
                  <div class="flex flex-col gap-2">
                    <div class="avatar justify-center">
                      <div class="w-12 rounded-full">
                        <img :src="member.avatar" />
                      </div>
                    </div>
                    <h3 class="font-semibold">{{ member.name }}</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="card-actions px-6">
            <button 
              class="btn btn-primary"
              @click="addFamilyMember"
            >{{ $t('Add family member') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '../../stores/user';
const { user } = useUserStore();
import { ref, onMounted } from 'vue';

const userStore = useUserStore();

// Fetch user data when component mounts
onMounted(async () => {
  await userStore.fetchUser();
});

const familyMembers = ref([
  {
    id: 1,
    name: 'John Doe',
    avatar: '/temp-avatars/avataaars2.png',
  },
  {
    id: 2,
    name: 'Jane Doe',
    avatar: '/temp-avatars/avataaars3.png',
  },
]);

const addFamilyMember = () => {
  console.log('addFamilyMember');
};
</script>