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
                required
              />
              <div v-if="errors.confirm_password" class="text-error text-sm mt-1">
                {{ errors.confirm_password }}
              </div>

              <div v-if="errors.general" class="text-error text-center mt-4">
                {{ errors.general }}
              </div>

              <button type="submit" class="btn btn-primary w-full mt-4">
                {{ $t('Register') }}
              </button>
            </div> 
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
});

const username = ref('');
const first_name = ref('');
const last_name = ref('');
const password = ref('');
const confirm_password = ref('');
const email = ref('');

const errors = ref({
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  confirm_password: '',
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
    general: ''
  };
};

const handleRegistration = async () => {
  clearErrors();
  let hasErrors = false;

  // validate form inputs
  if (!username.value) {
    errors.value.username = 'Username is required';
    hasErrors = true;
  }

  if (!email.value) {
    errors.value.email = 'Email is required';
    hasErrors = true;
  }

  if (!first_name.value) {
    errors.value.first_name = 'First name is required';
    hasErrors = true;
  }

  if (!last_name.value) {
    errors.value.last_name = 'Last name is required';
    hasErrors = true;
  }

  if (!password.value) {
    errors.value.password = 'Password is required';
    hasErrors = true;
  }

  if (!confirm_password.value) {
    errors.value.confirm_password = 'You need to confirm your password';
    hasErrors = true;
  }

  if (password.value !== confirm_password.value) {
    errors.value.confirm_password = 'Passwords do not match';
    hasErrors = true;
  }

  if (hasErrors) {
    return;
  }

  try {
    const response = await fetch('/api/user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        username: username.value, 
        email: email.value, 
        first_name: first_name.value, 
        last_name: last_name.value, 
        password: password.value 
      }),
    });

    if (response.ok) {
      navigateTo('/registration/step-2');
    } else {
      const data = await response.json();
      errors.value.general = data.message || 'Failed to register user';
    }
  } catch (error) {
    console.error('Error registering user:', error);
    errors.value.general = 'Failed to register user';
  }
};
</script>
