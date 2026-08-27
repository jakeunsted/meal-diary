import type { Ref } from 'vue';

export interface ShoppingListSortableOptions {
  /** Ordered ids currently rendered in this sortable zone (one category). */
  itemIds: Ref<Array<number | string>>;
  onReorder: (orderedIds: Array<number | string>) => void;
  /** Mouse: pixels of movement before drag activates. */
  mouseActivationDistance?: number;
  /** Touch: ms to hold before drag can activate. */
  touchActivationDelayMs?: number;
  /** Touch: pixels of movement after hold before drag activates. */
  touchActivationDistance?: number;
  /** Edge inset (px) that triggers auto-scroll while dragging. */
  autoScrollEdgePx?: number;
  autoScrollSpeedPx?: number;
}

interface DragState {
  pointerId: number;
  itemId: number | string;
  startY: number;
  startX: number;
  isTouch: boolean;
  activated: boolean;
  holdTimer: ReturnType<typeof setTimeout> | null;
  currentIndex: number;
  rowHeight: number;
  originTop: number;
}

/**
 * Pointer Events based sortable for a flat list of shopping items within one category.
 * Drag starts from a handle only (element matching [data-sortable-handle]).
 */
export function useShoppingListSortable(options: ShoppingListSortableOptions) {
  const listRef = ref<HTMLElement | null>(null);
  const draggingId = ref<number | string | null>(null);
  const dragOffsetY = ref(0);
  const previewOrder = ref<Array<number | string>>([]);

  const mouseActivationDistance = options.mouseActivationDistance ?? 4;
  const touchActivationDelayMs = options.touchActivationDelayMs ?? 160;
  const touchActivationDistance = options.touchActivationDistance ?? 6;
  const autoScrollEdgePx = options.autoScrollEdgePx ?? 48;
  const autoScrollSpeedPx = options.autoScrollSpeedPx ?? 12;

  let dragState: DragState | null = null;
  let autoScrollFrame: number | null = null;
  let lastPointerY = 0;

  const displayOrder = computed(() => {
    if (draggingId.value != null && previewOrder.value.length) {
      return previewOrder.value;
    }
    return options.itemIds.value;
  });

  const rowTranslateY = (itemId: number | string): number => {
    if (draggingId.value == null || !dragState) {
      return 0;
    }
    if (itemId === draggingId.value) {
      return dragOffsetY.value;
    }

    const fromIndex = options.itemIds.value.indexOf(draggingId.value);
    const toIndex = dragState.currentIndex;
    const itemIndex = options.itemIds.value.indexOf(itemId);
    if (fromIndex === -1 || itemIndex === -1 || fromIndex === toIndex) {
      return 0;
    }

    const height = dragState.rowHeight;
    if (fromIndex < toIndex && itemIndex > fromIndex && itemIndex <= toIndex) {
      return -height;
    }
    if (fromIndex > toIndex && itemIndex < fromIndex && itemIndex >= toIndex) {
      return height;
    }
    return 0;
  };

  const stopAutoScroll = () => {
    if (autoScrollFrame != null) {
      cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = null;
    }
  };

  const tickAutoScroll = () => {
    if (!dragState?.activated) {
      stopAutoScroll();
      return;
    }

    const viewportHeight = window.innerHeight;
    let delta = 0;
    if (lastPointerY < autoScrollEdgePx) {
      delta = -autoScrollSpeedPx;
    } else if (lastPointerY > viewportHeight - autoScrollEdgePx) {
      delta = autoScrollSpeedPx;
    }

    if (delta !== 0) {
      window.scrollBy(0, delta);
    }

    autoScrollFrame = requestAnimationFrame(tickAutoScroll);
  };

  const clearDrag = () => {
    stopAutoScroll();
    if (dragState?.holdTimer) {
      clearTimeout(dragState.holdTimer);
    }
    dragState = null;
    draggingId.value = null;
    dragOffsetY.value = 0;
    previewOrder.value = [];
  };

  const buildPreviewOrder = (fromIndex: number, toIndex: number): Array<number | string> => {
    const next = [...options.itemIds.value];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const activateDrag = (state: DragState, row: HTMLElement) => {
    state.activated = true;
    draggingId.value = state.itemId;
    state.rowHeight = row.getBoundingClientRect().height || 48;
    state.originTop = row.getBoundingClientRect().top;
    previewOrder.value = [...options.itemIds.value];
    if (autoScrollFrame == null) {
      autoScrollFrame = requestAnimationFrame(tickAutoScroll);
    }
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    lastPointerY = event.clientY;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;

    if (!dragState.activated) {
      const distance = Math.hypot(dx, dy);
      if (dragState.isTouch) {
        // Still waiting for hold timer; cancel if user scrolled.
        if (distance > touchActivationDistance * 2 && dragState.holdTimer) {
          clearTimeout(dragState.holdTimer);
          dragState.holdTimer = null;
          clearDrag();
        }
        return;
      }
      if (distance < mouseActivationDistance) {
        return;
      }
      const row = (event.target as HTMLElement | null)?.closest?.(
        '[data-sortable-row]'
      ) as HTMLElement | null;
      if (!row) {
        return;
      }
      activateDrag(dragState, row);
    }

    event.preventDefault();
    dragOffsetY.value = event.clientY - dragState.startY;

    const fromIndex = options.itemIds.value.indexOf(dragState.itemId);
    if (fromIndex === -1) {
      return;
    }

    const deltaIndex = Math.round(dragOffsetY.value / dragState.rowHeight);
    const toIndex = Math.max(
      0,
      Math.min(options.itemIds.value.length - 1, fromIndex + deltaIndex)
    );
    dragState.currentIndex = toIndex;
    previewOrder.value = buildPreviewOrder(fromIndex, toIndex);
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const state = dragState;
    const activated = state.activated;
    const fromIndex = options.itemIds.value.indexOf(state.itemId);
    const toIndex = state.currentIndex;

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);

    clearDrag();

    if (activated && fromIndex !== -1 && fromIndex !== toIndex) {
      options.onReorder(buildPreviewOrder(fromIndex, toIndex));
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === 'mouse') {
      return;
    }

    const target = event.target as HTMLElement | null;
    const handle = target?.closest?.('[data-sortable-handle]') as HTMLElement | null;
    if (!handle) {
      return;
    }

    const row = handle.closest('[data-sortable-row]') as HTMLElement | null;
    if (!row) {
      return;
    }

    const itemIdAttr = row.getAttribute('data-sortable-id');
    if (itemIdAttr == null) {
      return;
    }

    // Preserve numeric ids when possible.
    const numericId = Number(itemIdAttr);
    const itemId = Number.isFinite(numericId) && String(numericId) === itemIdAttr
      ? numericId
      : itemIdAttr;

    const currentIndex = options.itemIds.value.indexOf(itemId);
    if (currentIndex === -1) {
      return;
    }

    const isTouch = event.pointerType === 'touch' || event.pointerType === 'pen';
    lastPointerY = event.clientY;

    dragState = {
      pointerId: event.pointerId,
      itemId,
      startY: event.clientY,
      startX: event.clientX,
      isTouch,
      activated: false,
      holdTimer: null,
      currentIndex,
      rowHeight: row.getBoundingClientRect().height || 48,
      originTop: row.getBoundingClientRect().top,
    };

    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers may throw if capture is unsupported; window listeners still work.
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    if (isTouch) {
      dragState.holdTimer = setTimeout(() => {
        if (!dragState || dragState.activated) {
          return;
        }
        activateDrag(dragState, row);
      }, touchActivationDelayMs);
    }
  };

  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
    clearDrag();
  });

  return {
    listRef,
    draggingId,
    displayOrder,
    rowTranslateY,
    handlePointerDown,
    isDragging: computed(() => draggingId.value != null),
  };
}
