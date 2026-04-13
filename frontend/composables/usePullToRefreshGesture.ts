import { onMounted, onUnmounted, ref, toValue, type MaybeRef } from 'vue';

const PULL_COMMIT_PX = 14;

interface UsePullToRefreshGestureOptions {
  enabled: MaybeRef<boolean>;
  threshold?: MaybeRef<number>;
  maxPull?: MaybeRef<number>;
}

const getScrollEl = (): HTMLElement | null => {
  if (import.meta.server) {
    return null;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
};

const isScrollAtTop = (el: HTMLElement): boolean => {
  return el.scrollTop <= 1;
};

const touchTargetAllowsPull = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof Element)) {
    return true;
  }
  return !target.closest('dialog, [role="dialog"], .modal');
};

export const usePullToRefreshGesture = (options: UsePullToRefreshGestureOptions) => {
  const pull = ref(0);
  const isPulling = ref(false);

  let touchStartY = 0;
  let gestureCleanup: (() => void) | null = null;

  const endGestureListeners = () => {
    gestureCleanup?.();
    gestureCleanup = null;
  };

  const rubberBand = (delta: number): number => {
    const max =
      options.maxPull === undefined ? 120 : toValue(options.maxPull);
    const raw = delta * 0.48;
    return Math.min(max, raw);
  };

  const handleTouchEnd = () => {
    if (!toValue(options.enabled)) {
      isPulling.value = false;
      pull.value = 0;
      return;
    }
    const wasPulling = isPulling.value;
    const pullAtEnd = pull.value;
    const threshold =
      options.threshold === undefined ? 80 : toValue(options.threshold);
    isPulling.value = false;
    if (!wasPulling) {
      pull.value = 0;
      return;
    }
    if (pullAtEnd >= threshold) {
      reloadNuxtApp({ persistState: false, force: true });
    }
    pull.value = 0;
  };

  const handleTouchStart = (event: TouchEvent) => {
    endGestureListeners();

    if (!toValue(options.enabled)) {
      return;
    }
    if (!touchTargetAllowsPull(event.target)) {
      return;
    }
    const scrollEl = getScrollEl();
    if (!scrollEl || !isScrollAtTop(scrollEl)) {
      return;
    }
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    touchStartY = touch.clientY;
    pull.value = 0;
    isPulling.value = true;
    let pullCommitted = false;

    const onMove = (ev: TouchEvent) => {
      if (!toValue(options.enabled) || !isPulling.value) {
        return;
      }
      const root = getScrollEl();
      if (!root) {
        return;
      }
      if (!isScrollAtTop(root)) {
        pull.value = 0;
        pullCommitted = false;
        isPulling.value = false;
        endGestureListeners();
        return;
      }
      const currentTouch = ev.touches[0];
      if (!currentTouch) {
        return;
      }
      const delta = currentTouch.clientY - touchStartY;
      if (delta <= 0) {
        pull.value = 0;
        pullCommitted = false;
        return;
      }
      if (!pullCommitted && delta < PULL_COMMIT_PX) {
        return;
      }
      pullCommitted = true;
      ev.preventDefault();
      pull.value = rubberBand(delta);
    };

    const onEnd = () => {
      endGestureListeners();
      handleTouchEnd();
    };

    window.addEventListener('touchmove', onMove, { passive: false, capture: true });
    window.addEventListener('touchend', onEnd, { capture: true, passive: true });
    window.addEventListener('touchcancel', onEnd, { capture: true, passive: true });

    gestureCleanup = () => {
      window.removeEventListener('touchmove', onMove, { capture: true });
      window.removeEventListener('touchend', onEnd, { capture: true });
      window.removeEventListener('touchcancel', onEnd, { capture: true });
    };
  };

  onMounted(() => {
    if (import.meta.server) {
      return;
    }
    window.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
  });

  onUnmounted(() => {
    if (import.meta.server) {
      return;
    }
    window.removeEventListener('touchstart', handleTouchStart, { capture: true });
    endGestureListeners();
  });

  return {
    pull,
    isPulling
  };
};
