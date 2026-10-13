<template>
  <header
    class="flex shrink-0 items-center justify-between gap-3 border-b border-base-300 bg-base-100 px-4 py-2"
    data-testid="top-nav"
  >
    <NuxtLink to="/diary" class="text-lg font-bold" data-testid="top-nav-brand">
      {{ $t('Meal diary') }}
    </NuxtLink>
    <NuxtLink
      to="/profile"
      class="btn btn-ghost btn-sm"
      :class="{ 'btn-active': isProfile }"
      data-testid="top-nav-profile"
    >
      <fa icon="circle-user" />
      {{ $t('workspace.profile') }}
    </NuxtLink>
  </header>
</template>

<script setup lang="ts">
const route = useRoute();

const isProfile = computed(() => route.path === '/profile' || route.path.startsWith('/profile/'));
</script>
