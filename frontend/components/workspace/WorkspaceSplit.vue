<template>
  <div
    ref="rootRef"
    class="flex h-full min-h-0 min-w-0 w-full"
    :class="orientation === 'row' ? 'flex-row' : 'flex-col'"
    :data-axis="orientation"
  >
    <div
      class="flex min-h-0 min-w-0 flex-col overflow-hidden"
      :style="firstPaneStyle"
    >
      <slot name="first" />
    </div>
    <button
      type="button"
      class="group relative z-10 flex shrink-0 touch-none items-center justify-center bg-base-300/60 hover:bg-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      :class="orientation === 'row' ? 'w-2.5 cursor-col-resize' : 'h-2.5 cursor-row-resize'"
      role="separator"
      :aria-orientation="orientation === 'row' ? 'vertical' : 'horizontal'"
      :aria-valuemin="22"
      :aria-valuemax="78"
      :aria-valuenow="valueNow"
      :aria-label="$t('workspace.resize')"
      :data-testid="handleTestId"
      @pointerdown="handlePointerDown"
      @keydown="handleKeyDown"
    >
      <fa
        :icon="orientation === 'row' ? 'grip-vertical' : 'grip'"
        class="text-[10px] opacity-60 group-hover:opacity-100"
      />
    </button>
    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <slot name="second" />
    </div>
  </div>
</template>

<script setup lang="ts">
const HANDLE_PX = 10;

const props = withDefaults(defineProps<{
  orientation: 'row' | 'column';
  fraction: number;
  handleTestId?: string;
}>(), {
  handleTestId: 'workspace-split-handle',
});

const emit = defineEmits<{
  'update:fraction': [value: number];
  commit: [];
}>();

const rootRef = ref<HTMLElement | null>(null);

const valueNow = computed(() => Math.round(props.fraction * 100));

const firstPaneStyle = computed(() => {
  const size = `calc((100% - ${HANDLE_PX}px) * ${props.fraction})`;
  if (props.orientation === 'row') {
    return { width: size, height: '100%' };
  }
  return { height: size, width: '100%' };
});

const updateFromPoint = (clientX: number, clientY: number) => {
  const root = rootRef.value;
  if (!root) {
    return;
  }
  const rect = root.getBoundingClientRect();
  const offset = props.orientation === 'row' ? clientX - rect.left : clientY - rect.top;
  const size = props.orientation === 'row' ? rect.width : rect.height;
  if (size <= 0) {
    return;
  }
  emit('update:fraction', offset / size);
};

const handlePointerDown = (event: PointerEvent) => {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  document.body.style.userSelect = 'none';

  const handleMove = (moveEvent: PointerEvent) => {
    updateFromPoint(moveEvent.clientX, moveEvent.clientY);
  };

  const handleUp = (upEvent: PointerEvent) => {
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
    window.removeEventListener('pointercancel', handleUp);
    document.body.style.removeProperty('user-select');
    updateFromPoint(upEvent.clientX, upEvent.clientY);
    emit('commit');
  };

  window.addEventListener('pointermove', handleMove);
  window.addEventListener('pointerup', handleUp);
  window.addEventListener('pointercancel', handleUp);
};

const handleKeyDown = (event: KeyboardEvent) => {
  const step = event.shiftKey ? 0.08 : 0.02;
  let delta = 0;
  if (props.orientation === 'row' && event.key === 'ArrowRight') {
    delta = step;
  } else if (props.orientation === 'row' && event.key === 'ArrowLeft') {
    delta = -step;
  } else if (props.orientation === 'column' && event.key === 'ArrowDown') {
    delta = step;
  } else if (props.orientation === 'column' && event.key === 'ArrowUp') {
    delta = -step;
  }

  if (!delta) {
    return;
  }

  event.preventDefault();
  emit('update:fraction', props.fraction + delta);
  emit('commit');
};
</script>
