const readPullToRefreshEnabled = (): boolean => {
  if (!import.meta.client) {
    return false;
  }
  return window.matchMedia('(max-width: 768px)').matches;
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
      pullToRefreshEnabled.value = mq.matches;
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
