<template>
  <div class="max-w-4xl mx-auto">
    <div class="skeleton h-8 w-48 mx-auto mb-8"></div>

    <div class="card bg-base-200 shadow-sm m-4">
      <div class="card-body bg-base-300 rounded-lg">
        <div class="space-y-4">
          <div v-for="j in 6" :key="j" class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="skeleton h-6 w-6"></div>
              <div class="skeleton h-6 w-32"></div>
            </div>
            <div class="skeleton h-6 w-6"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skeleton {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: .5;
  }
}
</style>
