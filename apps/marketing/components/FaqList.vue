<script setup lang="ts">
interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

interface Props {
  items: FaqItem[];
}

const props = defineProps<Props>();
const { trackFaqOpen } = useMarketingAnalytics();
const openId = ref<string | null>(null);

const handleToggle = (id: string) => {
  const next = openId.value === id ? null : id;
  openId.value = next;
  if (next) {
    trackFaqOpen(id);
  }
};
</script>

<template>
  <div class="divide-y divide-ink-900/10 rounded-2xl border border-white/10 bg-ink-900/80">
    <div
      v-for="item in props.items"
      :key="item.id"
      class="px-4 sm:px-5"
    >
      <h3>
        <button
          type="button"
          class="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-semibold text-ink-50"
          :aria-expanded="openId === item.id"
          @click="handleToggle(item.id)"
        >
          <span>{{ item.question }}</span>
          <UIcon
            :name="openId === item.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="size-5 shrink-0 text-ink-400"
          />
        </button>
      </h3>
      <div
        v-show="openId === item.id"
        class="pb-4 text-sm leading-relaxed text-ink-300"
      >
        <p>{{ item.answer }}</p>
      </div>
    </div>
  </div>
</template>
