<template>
  <div class="flex justify-center gap-2 text-sm opacity-70">
    <NuxtLink class="link link-hover" to="/privacy" data-testid="privacy-link">
      {{ $t('Privacy Policy') }}
    </NuxtLink>
    <span>·</span>
    <NuxtLink class="link link-hover" to="/terms" data-testid="terms-link">
      {{ $t('Terms of Service') }}
    </NuxtLink>
    <span>·</span>
    <NuxtLink class="link link-hover" to="/support" data-testid="support-link">
      {{ $t('Support') }}
    </NuxtLink>
  </div>
</template>
