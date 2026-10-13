<template>
  <div
    ref="rootRef"
    class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-box border border-base-300 bg-base-200"
    :data-testid="`workspace-tile-${view}`"
    :data-variant="variant"
  >
    <div v-if="showSwitcher" class="shrink-0 border-b border-base-300 px-3 py-2">
      <select
        class="select select-bordered select-sm w-full max-w-xs"
        :aria-label="$t('workspace.switchView')"
        :data-testid="`workspace-tile-select-${switchIndex}`"
        :value="view"
        @change="handleViewChange"
      >
        <option value="diary">{{ $t('Meal diary') }}</option>
        <option value="recipes">{{ $t('Recipe Book') }}</option>
        <option value="shopping-list">{{ $t('Shopping List') }}</option>
      </select>
    </div>
    <div class="min-h-0 flex-1 overflow-hidden">
      <DiaryPanel v-if="view === 'diary'" :variant="variant" />
      <RecipesPanel v-else-if="view === 'recipes'" :variant="variant" />
      <ShoppingListPanel v-else :variant="variant" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkspaceView } from '~/composables/useWorkspaceLayout';
import DiaryPanel from '~/components/diary/DiaryPanel.vue';
import RecipesPanel from '~/components/recipe/RecipesPanel.vue';
import ShoppingListPanel from '~/components/shopping-list/ShoppingListPanel.vue';

const WIDE_MIN_PX = 520;

withDefaults(defineProps<{
  view: WorkspaceView;
  showSwitcher?: boolean;
  switchIndex?: number;
}>(), {
  showSwitcher: false,
  switchIndex: 0,
});

const emit = defineEmits<{
  'update:view': [view: WorkspaceView];
}>();

const rootRef = ref<HTMLElement | null>(null);
const variant = ref<'compact' | 'wide'>('compact');

const handleViewChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  if (value === 'diary' || value === 'recipes' || value === 'shopping-list') {
    emit('update:view', value);
  }
};

onMounted(() => {
  const root = rootRef.value;
  if (!root) {
    return;
  }

  const sync = (width: number) => {
    variant.value = width >= WIDE_MIN_PX ? 'wide' : 'compact';
  };

  sync(root.getBoundingClientRect().width);
  const observer = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? 0;
    sync(width);
  });
  observer.observe(root);
  onUnmounted(() => {
    observer.disconnect();
  });
});
</script>
