<template>
  <div class="max-w-4xl mx-auto">
    <div class="skeleton h-8 w-48 mx-auto mb-8"></div>
    
    <!-- Week picker skeleton -->
    <div class="p-4">
      <div class="flex flex-col md:flex-row gap-4">
        <div class="form-control w-full max-w-xs mx-auto text-center">
          <div class="skeleton h-6 w-32 mx-auto mb-2"></div>
          <div class="flex flex-row gap-2 justify-center">
            <div class="skeleton h-10 w-10"></div>
            <div class="skeleton h-10 w-48"></div>
            <div class="skeleton h-10 w-10"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Meal cards skeleton -->
    <div class="space-y-4">
      <div v-for="i in 7" :key="i" class="card bg-base-200 shadow-sm m-4">
        <div class="card-title justify-between my-2 flex items-center px-6">
          <div class="skeleton h-6 w-32"></div>
          <div class="skeleton h-6 w-6"></div>
        </div>
        <div class="card-body bg-base-300 rounded-b-lg">
          <div class="space-y-4">
            <!-- Breakfast -->
            <div class="flex justify-between items-center">
              <div class="skeleton h-6 w-24"></div>
              <div class="skeleton h-8 w-32"></div>
            </div>
            <!-- Lunch -->
            <div class="flex justify-between items-center">
              <div class="skeleton h-6 w-24"></div>
              <div class="skeleton h-8 w-32"></div>
            </div>
            <!-- Dinner -->
            <div class="flex justify-between items-center">
              <div class="skeleton h-6 w-24"></div>
              <div class="skeleton h-8 w-32"></div>
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