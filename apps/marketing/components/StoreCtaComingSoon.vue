<script setup lang="ts">
interface Props {
  placement: string;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
});

const { t } = useI18n();
const { trackIosComingSoon, trackAndroidComingSoon } = useMarketingAnalytics();

const handleIos = () => {
  trackIosComingSoon(props.placement);
};

const handleAndroid = () => {
  trackAndroidComingSoon(props.placement);
};
</script>

<template>
  <div :class="compact ? 'flex flex-wrap gap-2' : 'flex flex-col gap-2 sm:flex-row'">
    <UButton
      color="neutral"
      variant="ghost"
      :size="compact ? 'sm' : 'lg'"
      type="button"
      class="ring-1 ring-inset ring-white/20 !bg-ink-900/70 !text-ink-100 hover:!bg-ink-800 hover:!text-white"
      @click="handleIos"
    >
      {{ t('cta.iosComingSoon') }}
    </UButton>
    <UButton
      color="neutral"
      variant="ghost"
      :size="compact ? 'sm' : 'lg'"
      type="button"
      class="ring-1 ring-inset ring-white/20 !bg-ink-900/70 !text-ink-100 hover:!bg-ink-800 hover:!text-white"
      @click="handleAndroid"
    >
      {{ t('cta.androidComingSoon') }}
    </UButton>
  </div>
</template>
