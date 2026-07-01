<template>
  <div class="pb-20">
    <ClientOnly>
      <UpgradeBanner v-if="showSubscriptionChrome" />
      <TrialExpiredModal v-if="showSubscriptionChrome" />
      <PaywallModal />
    </ClientOnly>
    <slot />
    <BottomNavigator />
  </div>
</template>

<script setup>
import BottomNavigator from '~/components/nav/BottomNavigator.vue';
import PaywallModal from '~/components/subscription/PaywallModal.vue';
import TrialExpiredModal from '~/components/subscription/TrialExpiredModal.vue';
import UpgradeBanner from '~/components/subscription/UpgradeBanner.vue';

const route = useRoute();

const showSubscriptionChrome = computed(() => {
  const path = route.path;
  return !path.startsWith('/login') && !path.startsWith('/registration');
});

const shouldHideScrollbarMobile = computed(() => {
  const p = route.path;
  return p.endsWith('/diary') || p.endsWith('/shopping-list');
});

const syncScrollbarClass = () => {
  if (!import.meta.client) {
    return;
  }
  const el = document.documentElement;
  if (shouldHideScrollbarMobile.value) {
    el.classList.add('hide-scrollbar-mobile');
  } else {
    el.classList.remove('hide-scrollbar-mobile');
  }
};

watch(shouldHideScrollbarMobile, syncScrollbarClass, { flush: 'post' });

onMounted(() => {
  syncScrollbarClass();
});

onUnmounted(() => {
  if (import.meta.client) {
    document.documentElement.classList.remove('hide-scrollbar-mobile');
  }
});
</script>
