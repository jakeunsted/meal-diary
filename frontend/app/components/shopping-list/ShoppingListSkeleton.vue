<template>
  <div class="max-w-4xl mx-auto">
    <div class="skeleton h-8 w-48 mx-auto mb-8"></div>
    
    <div class="space-y-4">
      <!-- Skeleton categories -->
      <div v-for="i in 3" :key="i" class="card bg-base-200 shadow-sm m-4">
        <div class="card-title justify-between my-2 flex items-center px-6">
          <div class="skeleton h-6 w-32"></div>
          <div class="skeleton h-6 w-6"></div>
        </div>
        <div class="card-body bg-base-300 rounded-b-lg">
          <div class="space-y-4">
            <!-- Skeleton items -->
            <div v-for="j in 3" :key="j" class="flex items-center justify-between">
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