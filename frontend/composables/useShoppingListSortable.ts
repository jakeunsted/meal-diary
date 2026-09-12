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
  startScrollY: number;
  isTouch: boolean;
  activated: boolean;
  holdTimer: ReturnType<typeof setTimeout> | null;
  currentIndex: number;
  fromIndex: number;
  rowHeight: number;
}

/**
 * Pointer Events based sortable for a flat list of shopping items within one category.
 * Drag starts from a handle only (element matching [data-sortable-handle]).
 *
 * Behaviour matches list libraries like Base Web DnD:
 * - DOM order stays fixed while dragging
 * - The active row follows the pointer via translateY
 * - Sibling rows slide with transforms to open a gap
 * - Order is committed only on drop
 */
export function useShoppingListSortable(options: ShoppingListSortableOptions) {
  const listRef = ref<HTMLElement | null>(null);
  const draggingId = ref<number | string | null>(null);
  const dragOffsetY = ref(0);

  const mouseActivationDistance = options.mouseActivationDistance ?? 4;
  const touchActivationDelayMs = options.touchActivationDelayMs ?? 160;
  const touchActivationDistance = options.touchActivationDistance ?? 6;
  const autoScrollEdgePx = options.autoScrollEdgePx ?? 48;
  const autoScrollSpeedPx = options.autoScrollSpeedPx ?? 12;

  let dragState: DragState | null = null;
  let autoScrollFrame: number | null = null;
  let lastPointerY = 0;

  const displayOrder = computed(() => options.itemIds.value);

  const documentScrollY = () =>
    window.scrollY || document.documentElement.scrollTop || 0;

  const findRowElement = (itemId: number | string): HTMLElement | null => {
    const rows = listRef.value?.querySelectorAll('[data-sortable-row]');
    if (!rows) {
      return null;
    }
    const match = Array.from(rows).find(
      (row) => row.getAttribute('data-sortable-id') === String(itemId)
    );
    return (match as HTMLElement | undefined) ?? null;
  };

  const pointerDeltaY = (clientY: number, state: DragState): number =>
    clientY - state.startY + (documentScrollY() - state.startScrollY);

  const buildReorder = (fromIndex: number, toIndex: number): Array<number | string> => {
    const next = [...options.itemIds.value];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  /**
   * Keep the dragged row under the pointer. Sibling rows between the origin and
   * the live drop index shift by one row height to open a gap (Base Web style).
   */
  const rowTranslateY = (itemId: number | string): number => {
    if (draggingId.value == null || !dragState?.activated) {
      return 0;
    }

    if (itemId === draggingId.value) {
      return dragOffsetY.value;
    }

    const { fromIndex, currentIndex: toIndex, rowHeight } = dragState;
    const itemIndex = options.itemIds.value.indexOf(itemId);
    if (fromIndex === -1 || itemIndex === -1 || fromIndex === toIndex) {
      return 0;
    }

    if (fromIndex < toIndex && itemIndex > fromIndex && itemIndex <= toIndex) {
      return -rowHeight;
    }
    if (fromIndex > toIndex && itemIndex < fromIndex && itemIndex >= toIndex) {
      return rowHeight;
    }
    return 0;
  };

  const stopAutoScroll = () => {
    if (autoScrollFrame != null) {
      cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = null;
    }
  };

  const updateDropIndex = (state: DragState, clientY: number) => {
    const deltaY = pointerDeltaY(clientY, state);
    dragOffsetY.value = deltaY;

    const deltaIndex = Math.round(deltaY / state.rowHeight);
    const toIndex = Math.max(
      0,
      Math.min(options.itemIds.value.length - 1, state.fromIndex + deltaIndex)
    );
    state.currentIndex = toIndex;
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
      // Keep the dragged row glued to the pointer while the page scrolls.
      updateDropIndex(dragState, lastPointerY);
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
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('touch-action');
  };

  const activateDrag = (state: DragState, row: HTMLElement) => {
    state.activated = true;
    draggingId.value = state.itemId;
    const rect = row.getBoundingClientRect();
    state.rowHeight = rect.height || 48;
    document.body.style.userSelect = 'none';
    document.body.style.touchAction = 'none';
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
        // Still waiting for hold timer; cancel if the user started scrolling.
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
      const row = findRowElement(dragState.itemId);
      if (!row) {
        return;
      }
      activateDrag(dragState, row);
    }

    // Only preventDefault once the drag is active — avoids the browser
    // "Ignored attempt to cancel a touchmove" intervention during scroll.
    if (event.cancelable) {
      event.preventDefault();
    }

    updateDropIndex(dragState, event.clientY);
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const state = dragState;
    const activated = state.activated;
    const fromIndex = state.fromIndex;
    const toIndex = state.currentIndex;

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);

    clearDrag();

    if (activated && fromIndex !== -1 && fromIndex !== toIndex) {
      options.onReorder(buildReorder(fromIndex, toIndex));
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

    const fromIndex = options.itemIds.value.indexOf(itemId);
    if (fromIndex === -1) {
      return;
    }

    const isTouch = event.pointerType === 'touch' || event.pointerType === 'pen';
    lastPointerY = event.clientY;

    dragState = {
      pointerId: event.pointerId,
      itemId,
      startY: event.clientY,
      startX: event.clientX,
      startScrollY: documentScrollY(),
      isTouch,
      activated: false,
      holdTimer: null,
      currentIndex: fromIndex,
      fromIndex,
      rowHeight: row.getBoundingClientRect().height || 48,
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
