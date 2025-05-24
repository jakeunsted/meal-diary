<template>
  <div class="min-h-screen w-full flex items-center justify-center fixed inset-0">
    <div class="card w-96 bg-base-200">
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

const { login, isLoading, error } = useAuth();
const email = ref('');
const password = ref('');

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
</script>