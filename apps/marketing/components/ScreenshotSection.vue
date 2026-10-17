<script setup lang="ts">
interface Props {
  title: string;
  body: string;
  src: string;
  alt: string;
  reverse?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  reverse: false,
});

const { t } = useI18n();
const rootEl = ref<HTMLElement | null>(null);
const isVisible = ref(false);
const imgError = ref(false);
const prefersReducedMotion = ref(false);

let observer: IntersectionObserver | null = null;

onMounted(() => {
  if (typeof window === 'undefined') return;

  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion.value) {
    isVisible.value = true;
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          isVisible.value = true;
          observer?.disconnect();
        }
      }
    },
    { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
  );

  if (rootEl.value) observer.observe(rootEl.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

const handleImgError = () => {
  imgError.value = true;
};
</script>

<template>
  <section
    ref="rootEl"
    class="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:py-20"
    :class="reverse ? 'lg:[&>*:first-child]:order-2' : ''"
  >
    <div
      class="transition-all duration-700 ease-out"
      :class="isVisible || prefersReducedMotion ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
    >
      <h2 class="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {{ title }}
      </h2>
      <p class="mt-4 text-base leading-relaxed text-ink-300 sm:text-lg">
        {{ body }}
      </p>
      <slot />
    </div>

    <div
      class="relative transition-all duration-700 ease-out delay-100"
      :class="isVisible || prefersReducedMotion ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
    >
      <div class="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-brand-500/30 via-ink-800/40 to-transparent blur-2xl" aria-hidden="true" />
      <figure class="relative mx-auto max-w-sm overflow-hidden rounded-[1.75rem] border border-white/10 bg-ink-950 shadow-2xl shadow-black/40">
        <img
          v-if="!imgError"
          :src="src"
          :alt="alt"
          class="block h-auto w-full"
          loading="lazy"
          decoding="async"
          width="390"
          height="844"
          @error="handleImgError"
        >
        <div
          v-else
          class="flex aspect-[9/19] items-center justify-center bg-ink-900 px-6 text-center text-sm text-ink-300"
          role="img"
          :aria-label="alt"
        >
          {{ t('screenshot.placeholder') }}
        </div>
      </figure>
    </div>
  </section>
</template>
