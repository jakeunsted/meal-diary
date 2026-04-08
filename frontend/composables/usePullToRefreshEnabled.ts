import { Capacitor } from '@capacitor/core';

const readPullToRefreshEnabled = (): boolean => {
  if (!import.meta.client) {
    return false;
  }
  const mq = window.matchMedia('(max-width: 768px)');
  return Capacitor.isNativePlatform() || mq.matches;
};

export const usePullToRefreshEnabled = () => {
  const pullToRefreshEnabled = ref(readPullToRefreshEnabled());
  const removeMediaQueryListener = ref<(() => void) | null>(null);

  onMounted(() => {
    if (!import.meta.client) {
      return;
    }
    const mq = window.matchMedia('(max-width: 768px)');
    const sync = () => {
      pullToRefreshEnabled.value = Capacitor.isNativePlatform() || mq.matches;
    };
    sync();
    mq.addEventListener('change', sync);
    removeMediaQueryListener.value = () => mq.removeEventListener('change', sync);
  });

  onUnmounted(() => {
    removeMediaQueryListener.value?.();
  });

  return { pullToRefreshEnabled };
};
