<template>
  <div
    ref="scrollRootRef"
    class="pull-to-refresh-root min-h-[100dvh] overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
    @touchstart.passive="handleTouchStart"
  >
    <div class="flex flex-col min-h-full">
      <div
        class="flex shrink-0 flex-col overflow-hidden"
        :class="{ 'transition-[height] duration-200 ease-out': !isPulling }"
        :style="{ height: `${pull}px` }"
        aria-hidden="true"
      >
        <div class="min-h-0 flex-1" />
        <div class="flex justify-center pb-1">
          <fa
            icon="arrows-rotate"
            class="text-lg text-primary"
            :style="{ opacity: iconOpacity }"
          />
        </div>
      </div>
      <div class="flex-1 min-h-0">
        <slot />
      </div>
    </div>
    <span class="sr-only" role="status">{{ t('Pull down to refresh') }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';

interface Props {
  enabled?: boolean;
  threshold?: number;
  maxPull?: number;
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true,
  threshold: 80,
  maxPull: 120
});

const { t } = useI18n();
const scrollRootRef = ref<HTMLElement | null>(null);
const pull = ref(0);
const isPulling = ref(false);

let touchStartY = 0;
let gestureCleanup: (() => void) | null = null;

const endGestureListeners = () => {
  gestureCleanup?.();
  gestureCleanup = null;
};

/** True when the scroller is at (or effectively at) the top; avoids iOS subpixel scrollTop. */
const isScrollAtTop = (el: HTMLElement): boolean => {
  return el.scrollTop <= 1;
};

const rubberBand = (delta: number): number => {
  const raw = delta * 0.48;
  return Math.min(props.maxPull, raw);
};

const iconOpacity = computed(() => {
  if (props.threshold <= 0) {
    return 0;
  }
  return Math.min(1, pull.value / props.threshold);
});

const handleTouchStart = (event: TouchEvent) => {
  endGestureListeners();

  if (!props.enabled) {
    return;
  }
  const el = scrollRootRef.value;
  if (!el || !isScrollAtTop(el)) {
    return;
  }
  const touch = event.touches[0];
  if (!touch) {
    return;
  }

  touchStartY = touch.clientY;
  pull.value = 0;
  isPulling.value = true;

  const onMove = (ev: TouchEvent) => {
    if (!props.enabled || !isPulling.value) {
      return;
    }
    const root = scrollRootRef.value;
    if (!root) {
      return;
    }
    if (!isScrollAtTop(root)) {
      pull.value = 0;
      isPulling.value = false;
      endGestureListeners();
      return;
    }
    const t = ev.touches[0];
    if (!t) {
      return;
    }
    const delta = t.clientY - touchStartY;
    if (delta <= 0) {
      pull.value = 0;
      return;
    }
    ev.preventDefault();
    pull.value = rubberBand(delta);
  };

  const onEnd = () => {
    endGestureListeners();
    handleTouchEnd();
  };

  document.addEventListener('touchmove', onMove, { passive: false, capture: true });
  document.addEventListener('touchend', onEnd, { capture: true, passive: true });
  document.addEventListener('touchcancel', onEnd, { capture: true, passive: true });

  gestureCleanup = () => {
    document.removeEventListener('touchmove', onMove, { capture: true });
    document.removeEventListener('touchend', onEnd, { capture: true });
    document.removeEventListener('touchcancel', onEnd, { capture: true });
  };
};

const handleTouchEnd = () => {
  if (!props.enabled) {
    isPulling.value = false;
    pull.value = 0;
    return;
  }
  const wasPulling = isPulling.value;
  const pullAtEnd = pull.value;
  isPulling.value = false;
  if (!wasPulling) {
    pull.value = 0;
    return;
  }
  if (pullAtEnd >= props.threshold) {
    // Default reloadNuxtApp ttl is 10s; force avoids ignoring repeat pulls.
    reloadNuxtApp({ persistState: false, force: true });
  }
  pull.value = 0;
};

onMounted(() => {
  if (import.meta.server) {
    return;
  }
  nextTick(() => {
    scrollRootRef.value?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
});

onUnmounted(() => {
  endGestureListeners();
});
</script>
