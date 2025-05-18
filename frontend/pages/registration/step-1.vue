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

const handleRegistration = async () => {
  // validate form inputs
  if (!username.value) {
    alert('Username is required');
    return;
  }

  if (!first_name.value) {
    alert('First name is required');
    return;
  }

  if (!last_name.value) {
    alert('Last name is required');
    return;
  }

  if (!password.value) {
    alert('Password is required');
    return;
  }

  if (!confirm_password.value) {
    alert('You need to confirm your password');
    return;
  }

  if (password.value !== confirm_password.value) {
    alert('Passwords do not match');
    return;
  }

  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username: username.value, first_name: first_name.value, last_name: last_name.value, password: password.value }),
    });

    if (response.ok) {
      alert('User registered successfully');
      navigateTo('/registration/step-2');
    } else {
      alert('Failed to register user');
    }
  } catch (error) {
    console.error('Error registering user:', error);
    alert('Failed to register user');
  }
};
</script>
