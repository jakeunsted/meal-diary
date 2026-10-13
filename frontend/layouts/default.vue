<template>
  <div :class="shellClass">
    <TopNavigator v-if="isTabletUp" />
    <ClientOnly>
      <UpgradeBanner v-if="showSubscriptionChrome" />
    </ClientOnly>
    <div :class="bodyClass">
      <WorkspaceShell v-if="showWorkspace" />
      <!-- Keep the page outlet mounted so later routes, such as profile, can render. -->
      <div v-show="!showWorkspace">
        <slot />
      </div>
    </div>
    <ClientOnly>
      <TrialExpiredModal v-if="showSubscriptionChrome" />
      <PaywallModal />
    </ClientOnly>
    <BottomNavigator v-if="!isTabletUp" />
  </div>
</template>

<script setup>
import BottomNavigator from '~/components/nav/BottomNavigator.vue';
import TopNavigator from '~/components/nav/TopNavigator.vue';
import WorkspaceShell from '~/components/workspace/WorkspaceShell.vue';
import PaywallModal from '~/components/subscription/PaywallModal.vue';
import TrialExpiredModal from '~/components/subscription/TrialExpiredModal.vue';
import UpgradeBanner from '~/components/subscription/UpgradeBanner.vue';

const route = useRoute();
const { isTabletUp, showWorkspace } = useWorkspaceMode();

const showSubscriptionChrome = computed(() => {
  const path = route.path;
  return !path.startsWith('/login') && !path.startsWith('/registration');
});

const shellClass = computed(() => {
  if (isTabletUp.value) {
    return 'fixed inset-0 flex flex-col bg-base-100 pt-[env(safe-area-inset-top)]';
  }
  return 'overflow-x-hidden';
});

const bodyClass = computed(() => {
  if (showWorkspace.value) {
    return 'flex min-h-0 flex-1 flex-col overflow-hidden';
  }
  if (isTabletUp.value) {
    return 'min-h-0 flex-1 overflow-y-auto';
  }
  return 'pb-20 min-w-0';
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
