<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const { webAppUrl } = useAppLinks();
const { trackNavClick, trackWebAppCta } = useMarketingAnalytics();

const mobileOpen = ref(false);

const navItems = computed(() => [
  { key: 'home', to: '/', label: t('nav.home') },
  { key: 'features', to: '/features', label: t('nav.features') },
  { key: 'pricing', to: '/pricing', label: t('nav.pricing') },
  { key: 'about', to: '/about', label: t('nav.about') },
]);

const isActive = (path: string) => {
  if (path === '/') return route.path === '/';
  return route.path === path || route.path.startsWith(`${path}/`);
};

const handleNavClick = (key: string) => {
  trackNavClick(key);
  mobileOpen.value = false;
};

const handleOpenApp = () => {
  trackWebAppCta('nav');
  mobileOpen.value = false;
};

const handleToggleMenu = () => {
  mobileOpen.value = !mobileOpen.value;
};
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-white/5 bg-ink-950/90 backdrop-blur-md">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <NuxtLink
        to="/"
        class="flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight text-white sm:text-2xl"
        :aria-label="t('a11y.homeLogo')"
        @click="handleNavClick('brand')"
      >
        <img
          src="/logo-72.png"
          alt=""
          width="36"
          height="36"
          class="size-9 rounded-xl shadow-sm shadow-black/30"
          decoding="async"
          aria-hidden="true"
        >
        <span aria-hidden="true">{{ t('brand.name') }}</span>
      </NuxtLink>

      <nav class="hidden items-center gap-1 md:flex" aria-label="Primary">
        <NuxtLink
          v-for="item in navItems"
          :key="item.key"
          :to="item.to"
          class="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="isActive(item.to) ? 'bg-brand-500/20 text-brand-300' : 'text-ink-300 hover:bg-white/10 hover:text-white'"
          @click="handleNavClick(item.key)"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="flex items-center gap-2">
        <UButton
          :to="webAppUrl('nav')"
          color="primary"
          size="sm"
          class="hidden sm:inline-flex"
          @click="handleOpenApp"
        >
          {{ t('nav.openApp') }}
        </UButton>

        <UButton
          class="md:hidden"
          color="neutral"
          variant="ghost"
          square
          :aria-label="mobileOpen ? t('nav.closeMenu') : t('nav.menu')"
          @click="handleToggleMenu"
        >
          <UIcon :name="mobileOpen ? 'i-lucide-x' : 'i-lucide-menu'" class="size-5" />
        </UButton>
      </div>
    </div>

    <div
      v-if="mobileOpen"
      class="border-t border-white/5 bg-ink-950 px-4 py-3 md:hidden"
    >
      <nav class="flex flex-col gap-1" aria-label="Mobile">
        <NuxtLink
          v-for="item in navItems"
          :key="item.key"
          :to="item.to"
          class="rounded-lg px-3 py-2.5 text-sm font-medium"
          :class="isActive(item.to) ? 'bg-brand-500/20 text-brand-300' : 'text-ink-200'"
          @click="handleNavClick(item.key)"
        >
          {{ item.label }}
        </NuxtLink>
        <UButton
          :to="webAppUrl('nav_mobile')"
          color="primary"
          class="mt-2"
          block
          @click="handleOpenApp"
        >
          {{ t('nav.openApp') }}
        </UButton>
      </nav>
    </div>
  </header>
</template>
