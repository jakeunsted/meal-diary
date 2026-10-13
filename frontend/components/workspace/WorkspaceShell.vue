<template>
  <div
    ref="shellRef"
    class="flex min-h-0 min-w-0 flex-1 p-3"
    data-testid="workspace-shell"
    :data-mode="mode"
  >
    <WorkspaceSplit
      v-if="mode === 'board'"
      data-testid="workspace-board"
      :data-fraction="state.boardDiaryFraction"
      orientation="column"
      :fraction="state.boardDiaryFraction"
      handle-test-id="workspace-board-diary-handle"
      @update:fraction="setBoardDiaryFraction"
      @commit="persist"
    >
      <template #first>
        <WorkspaceTile view="diary" />
      </template>
      <template #second>
        <WorkspaceSplit
          orientation="row"
          :fraction="state.boardRecipesFraction"
          handle-test-id="workspace-board-side-handle"
          @update:fraction="setBoardRecipesFraction"
          @commit="persist"
        >
          <template #first>
            <WorkspaceTile view="recipes" />
          </template>
          <template #second>
            <WorkspaceTile view="shopping-list" />
          </template>
        </WorkspaceSplit>
      </template>
    </WorkspaceSplit>

    <WorkspaceSplit
      v-else
      data-testid="workspace-split"
      :orientation="splitOrientation"
      :fraction="state.splitFraction"
      handle-test-id="workspace-split-handle"
      @update:fraction="setSplitFraction"
      @commit="persist"
    >
      <template #first>
        <WorkspaceTile
          show-switcher
          :switch-index="0"
          :view="state.splitViews[0]"
          @update:view="handleSplitView(0, $event)"
        />
      </template>
      <template #second>
        <WorkspaceTile
          show-switcher
          :switch-index="1"
          :view="state.splitViews[1]"
          @update:view="handleSplitView(1, $event)"
        />
      </template>
    </WorkspaceSplit>
  </div>
</template>

<script setup lang="ts">
import type { WorkspaceView } from '~/composables/useWorkspaceLayout';
import WorkspaceSplit from '~/components/workspace/WorkspaceSplit.vue';
import WorkspaceTile from '~/components/workspace/WorkspaceTile.vue';

const { mode } = useWorkspaceMode();
const {
  state,
  persist,
  setBoardDiaryFraction,
  setBoardRecipesFraction,
  setSplitFraction,
  setSplitView,
} = useWorkspaceLayout();

const shellRef = ref<HTMLElement | null>(null);
const splitOrientation = ref<'row' | 'column'>('row');

const handleSplitView = (index: 0 | 1, view: WorkspaceView) => {
  setSplitView(index, view);
};

onMounted(() => {
  const shell = shellRef.value;
  if (!shell) {
    return;
  }

  const sync = () => {
    const rect = shell.getBoundingClientRect();
    splitOrientation.value = rect.width >= rect.height ? 'row' : 'column';
  };

  sync();
  const observer = new ResizeObserver(sync);
  observer.observe(shell);
  onUnmounted(() => {
    observer.disconnect();
  });
});
</script>
