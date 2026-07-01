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
                type="email" 
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

              <div class="divider">{{ $t('OR') }}</div>

              <button
                type="button"
                class="btn btn-outline w-full"
                :disabled="isLoading"
                @click="handleGoogleSignup"
              >
                <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {{ $t('Sign up with Google') }}
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
const { signInWithGoogle, isLoading: isGoogleLoading } = useGoogleAuth();
const { track } = useAnalytics();

const username = ref('');
const first_name = ref('');
const last_name = ref('');
const password = ref('');
const confirm_password = ref('');
const email = ref('');
const terms_accepted = ref(false);
const isSubmitting = ref(false);

const isLoading = computed(() => isSubmitting.value || isGoogleLoading.value);

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
  isSubmitting.value = true;
  
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
    isSubmitting.value = false;
  }
};

const handleGoogleSignup = async () => {
  clearErrors();
  try {
    await signInWithGoogle();
    track('sign_up', { method: 'google' });
  } catch (error) {
    console.error('Google signup error:', error);
    errors.value.general = 'Google sign-up failed. Please try again.';
  }
};
</script>
