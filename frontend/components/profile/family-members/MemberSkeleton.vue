<template>
  <div>
    <div v-for="i in 4" :key="i" class="flex flex-col items-center p-4 bg-base-200 rounded-xl">
      <div class="skeleton w-16 h-16 rounded-full mb-3"></div>
      <div class="skeleton h-4 w-24"></div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'MemberSkeleton',
};
</script>

<style scoped>
.skeleton {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>