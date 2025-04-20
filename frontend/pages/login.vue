<template>
  <div class="flex justify-center items-center h-screen">
    <div class="card w-96 bg-base-200">
      <div class="card-body">
        <div class="card-title">
          <h1>Welcome to meal diary</h1>
        </div>
        <hr />
        <button
          @click="handleLogin"
          class="btn btn-primary"
          :disabled="isLoading"
        >
          Login with Auth0
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
})
const { login, isLoading } = useAuth();

const handleLogin = () => {
  login()
}

</script>