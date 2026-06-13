<template>
  <div>
    <div class="flex justify-center items-center h-screen">
      <div class="card w-96 bg-base-200">
        <div class="card-body">
          <div class="card-title">
            <h1>{{ $t('Registration') }}</h1>
          </div>
          <hr />
          <form @submit.prevent="handleRegistration" class="space-y-4">
            <div class="form-control">
              <label class="label mb-2">
                <span class="label-text">{{ $t('Username') }}</span>
              </label>
              <input 
                type="text" 
                v-model="username" 
                placeholder="Username" 
                class="input input-bordered" 
                :disabled="isLoading"
                required
              />
              <div v-if="errors.username" class="text-error text-sm mt-1">
                {{ errors.username }}
              </div>

              <label class="label mt-4 mb-2">
                <span class="label-text">{{ $t('Email') }}</span>
              </label>
              <input 
                type="text" 
                v-model="email" 
                placeholder="Email" 
                class="input input-bordered" 
                :disabled="isLoading"
                required
              />
              <div v-if="errors.email" class="text-error text-sm mt-1">
                {{ errors.email }}
              </div>

              <label class="label mt-4 mb-2">
                <span class="label-text">{{ $t('First name') }}</span>
              </label>
              <input 
                type="text" 
                v-model="first_name" 
                placeholder="First name" 
                class="input input-bordered" 
                :disabled="isLoading"
                required
              />
              <div v-if="errors.first_name" class="text-error text-sm mt-1">
                {{ errors.first_name }}
              </div>

              <label class="label mt-4 mb-2">
                <span class="label-text">{{ $t('Last name') }}</span>
              </label>
              <input 
                type="text" 
                v-model="last_name" 
                placeholder="Last name"
                class="input input-bordered"
                :disabled="isLoading"
                required
              />
              <div v-if="errors.last_name" class="text-error text-sm mt-1">
                {{ errors.last_name }}
              </div>

              <label class="label mt-4 mb-2">
                <span class="label-text">{{ $t('Password') }}</span>
              </label>
              <input 
                type="password" 
                v-model="password" 
                placeholder="Password"
                class="input input-bordered"
                :disabled="isLoading"
                required
              />
              <div v-if="errors.password" class="text-error text-sm mt-1">
                {{ errors.password }}
              </div>

              <label class="label mt-4 mb-2">
                <span class="label-text">{{ $t('Confirm password') }}</span>
              </label>
              <input 
                type="password" 
                v-model="confirm_password" 
                placeholder="Confirm password"
                class="input input-bordered"
                :disabled="isLoading"
                required
              />
              <div v-if="errors.confirm_password" class="text-error text-sm mt-1">
                {{ errors.confirm_password }}
              </div>

              <p class="text-sm opacity-70 mt-4">
                {{ $t('You must be at least 13 years old to use Meal Diary.') }}
              </p>

              <label class="label cursor-pointer justify-start gap-3 mt-2">
                <input
                  type="checkbox"
                  v-model="terms_accepted"
                  class="checkbox checkbox-primary"
                  data-testid="terms-checkbox"
                  :disabled="isLoading"
                />
                <span class="label-text">
                  {{ $t('I agree to the') }}
                  <NuxtLink class="link link-primary" to="/terms" target="_blank">{{ $t('Terms of Service') }}</NuxtLink>
                  {{ $t('and') }}
                  <NuxtLink class="link link-primary" to="/privacy" target="_blank">{{ $t('Privacy Policy') }}</NuxtLink>
                </span>
              </label>
              <div v-if="errors.terms_accepted" class="text-error text-sm mt-1" data-testid="terms-error">
                {{ errors.terms_accepted }}
              </div>

              <div v-if="errors.general" class="text-error text-center mt-4">
                {{ errors.general }}
              </div>

              <button
                type="submit"
                class="btn btn-primary w-full mt-4"
                :disabled="isLoading"
              >
                <span v-if="isLoading" class="loading loading-spinner loading-sm"></span>
                <span v-else>{{ $t('Register') }}</span>
              </button>
            </div>
          </form>
          <LegalLinks class="mt-4" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
});

import LegalLinks from '~/components/LegalLinks.vue';

const { performRegistration, storeRegisterString, deleteRegisterString } = useRegister();
const { track } = useAnalytics();

const username = ref('');
const first_name = ref('');
const last_name = ref('');
const password = ref('');
const confirm_password = ref('');
const email = ref('');
const terms_accepted = ref(false);
const isLoading = ref(false);

const errors = ref({
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  confirm_password: '',
  terms_accepted: '',
  general: ''
});

const clearErrors = () => {
  errors.value = {
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    confirm_password: '',
    terms_accepted: '',
    general: ''
  };
};

onMounted(async () => {
  // get code query param
  const code = useRoute().query.code;
  if (code) {
    await storeRegisterString(code);
  }
});

const handleRegistration = async () => {
  clearErrors();
  isLoading.value = true;
  
  try {
    const result = await performRegistration({
      username: username.value,
      email: email.value,
      first_name: first_name.value,
      last_name: last_name.value,
      password: password.value,
      confirm_password: confirm_password.value,
      terms_accepted: terms_accepted.value
    });

    if (result.hasErrors) {
      errors.value = result.errors;
    } else {
      if (result.response && result.response.ok) {
        track('sign_up', { method: 'email', has_family_code: !!useRoute().query.code });
        deleteRegisterString();
        navigateTo('/registration/step-2');
      } else {
        errors.value.general = result.response?.statusText || 'Registration failed';
      }
    }
  } catch (error) {
    console.error('Registration error:', error);
    errors.value.general = 'Registration failed. Please try again.';
  } finally {
    isLoading.value = false;
  }
};
</script>
