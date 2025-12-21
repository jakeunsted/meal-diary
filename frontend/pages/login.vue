<template>
  <div class="absolute inset-0 flex items-center justify-center bg-base-100">
    <div class="card w-96 bg-base-200 shadow-xl">
      <div class="card-body">
        <div class="card-title">
          <h1>{{ $t('Welcome to meal diary') }}</h1>
        </div>
        <hr />
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">{{ $t('Email') }}</span>
            </label>
            <input 
              type="email" 
              v-model="email" 
              placeholder="your@email.com" 
              class="input input-bordered" 
              :disabled="isLoading"
              required
            />
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text">{{ $t('Password') }}</span>
            </label>
            <input 
              type="password" 
              v-model="password" 
              placeholder="••••••••" 
              class="input input-bordered" 
              :disabled="isLoading"
              required
            />
          </div>
          <div v-if="error" class="alert alert-error">
            <span>{{ error }}</span>
          </div>
          <button
            type="submit"
            class="btn btn-primary w-full"
            :disabled="isLoading"
          >
            <span v-if="isLoading" class="loading loading-spinner"></span>
            <span v-else>{{ $t('Login') }}</span>
          </button>
          <div class="divider">{{ $t('OR') }}</div>
          <button
            type="button"
            class="btn btn-outline w-full"
            :disabled="isLoading"
            @click="handleGoogleLogin"
          >
            <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {{ $t('Sign in with Google') }}
          </button>
          <div class="text-center">
            <p>
              {{ $t('Don\'t have an account?') }} 
              <a class="link link-hover link-primary" href="/registration/step-1">{{ $t('Register') }}</a>
            </p>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false,
  middleware: ['auth']
});

const { login, isLoading: isEmailLoginLoading, error: emailLoginError } = useAuth();
const { signInWithGoogle, isLoading: isGoogleLoginLoading, error: googleLoginError } = useGoogleAuth();
const email = ref('');
const password = ref('');

const isLoading = computed(() => isEmailLoginLoading.value || isGoogleLoginLoading.value);
const error = computed(() => emailLoginError.value || googleLoginError.value);

const handleLogin = async () => {
  try {
    const response = await login(email.value, password.value);
    if (response && response.redirect) {
      navigateTo(response.redirect);
    }
  } catch (err) {
    console.error('Login error:', err);
  }
};

const handleGoogleLogin = async () => {
  try {
    await signInWithGoogle();
  } catch (err) {
    console.error('Google login error:', err);
  }
};
</script>