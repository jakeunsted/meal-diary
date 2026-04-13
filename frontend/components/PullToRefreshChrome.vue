<template>
  <Teleport to="body">
    <div>
      <div
        class="pointer-events-none fixed left-0 right-0 z-30 flex flex-col items-center overflow-hidden"
        :class="{ 'transition-[height] duration-200 ease-out': !isPulling }"
        :style="pullStripStyle"
        aria-hidden="true"
      >
        <div
          class="absolute inset-0"
          :style="haloStyle"
        />
        <div class="relative z-10 flex min-h-0 w-full flex-1 flex-col">
          <div class="min-h-0 w-full flex-1" />
          <div class="flex shrink-0 justify-center pb-1">
            <fa
              icon="arrows-rotate"
              class="text-lg text-primary"
              :style="{ opacity: iconOpacity }"
            />
          </div>
        </div>
      </div>
      <span class="sr-only" role="status">{{ t('Pull down to refresh') }}</span>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import { usePullToRefreshGesture } from '~/composables/usePullToRefreshGesture';

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

const { pull, isPulling } = usePullToRefreshGesture({
  enabled: toRef(props, 'enabled'),
  threshold: toRef(props, 'threshold'),
  maxPull: toRef(props, 'maxPull')
});

const iconOpacity = computed(() => {
  if (props.threshold <= 0) {
    return 0;
  }
  return Math.min(1, pull.value / props.threshold);
});

/** Curved bottom edge (arc dips slightly at center) via clip-path; works with overflow-hidden. */
const pullStripStyle = computed(() => ({
  top: 'env(safe-area-inset-top, 0px)',
  height: `${pull.value}px`,
  clipPath:
    "path('M 0 0 L 100% 0 L 100% 78% Q 50% 100% 0 78% Z')"
}));

/** Soft circular glow; bottom edge is feathered (mask) so overflow clip is not a hard line. */
const haloStyle = computed(() => {
  const fade = iconOpacity.value;
  const radial = [
    'radial-gradient(ellipse 135% 115% at 50% 100%,',
    'color-mix(in oklch, var(--color-primary, oklch(0.55 0.2 280)) 20%, transparent) 0%,',
    'color-mix(in oklch, var(--color-primary, oklch(0.55 0.2 280)) 10%, transparent) 28%,',
    'color-mix(in oklch, var(--color-base-content, oklch(0.4 0.02 260)) 6%, transparent) 48%,',
    'transparent 88%)'
  ].join(' ');
  const bottomFeather =
    'linear-gradient(to bottom, #000 0%, #000 48%, rgba(0,0,0,0.45) 72%, rgba(0,0,0,0.12) 88%, transparent 100%)';
  return {
    opacity: fade,
    background: radial,
    WebkitMaskImage: bottomFeather,
    maskImage: bottomFeather
  };
});
</script>
