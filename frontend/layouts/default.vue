<template>
  <div class="pb-20">
    <slot />
    <BottomNavigator />
  </div>
</template>

<script setup>
import BottomNavigator from '~/components/nav/BottomNavigator.vue';

const route = useRoute();

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
