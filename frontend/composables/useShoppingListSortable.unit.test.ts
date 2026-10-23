import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useShoppingListSortable } from './useShoppingListSortable';

describe('useShoppingListSortable', () => {
  it('reorders after a pointer drag and ignores a click that is not on the handle', () => {
    const onReorder = vi.fn();
    const itemIds = ref<Array<number | string>>([1, 2, 3]);
    const listeners = new Map<string, (event: PointerEvent) => void>();
    vi.stubGlobal('window', {
      scrollY: 0,
      innerHeight: 800,
      addEventListener: (type: string, listener: (event: PointerEvent) => void) => {
        listeners.set(type, listener);
      },
      removeEventListener: (type: string) => listeners.delete(type),
      scrollBy: vi.fn(),
    });
    vi.stubGlobal('document', {
      documentElement: { scrollTop: 0 },
      body: { style: { removeProperty: vi.fn() } },
    });
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});

    const row = {
      getAttribute: (name: string) => (name === 'data-sortable-id' ? '1' : null),
      getBoundingClientRect: () => ({ height: 40 }),
      closest: (selector: string) => (selector === '[data-sortable-row]' ? row : null),
    };
    const handle = {
      closest: (selector: string) => {
        if (selector === '[data-sortable-handle]') return handle;
        if (selector === '[data-sortable-row]') return row;
        return null;
      },
      setPointerCapture: vi.fn(),
    };
    const sortable = useShoppingListSortable({ itemIds, onReorder });
    const style = { removeProperty: vi.fn() };
    sortable.listRef.value = {
      querySelectorAll: () => [row],
      style,
    } as unknown as HTMLElement;

    sortable.handlePointerDown({
      button: 0,
      pointerType: 'mouse',
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      target: { closest: () => null },
    } as unknown as PointerEvent);
    expect(listeners.size).toBe(0);

    sortable.handlePointerDown({
      button: 0,
      pointerType: 'mouse',
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      target: handle,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);

    listeners.get('pointermove')?.({
      pointerId: 1,
      clientX: 10,
      clientY: 60,
      cancelable: true,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);
    expect(sortable.rowTranslateY(1)).not.toBe(0);

    listeners.get('pointerup')?.({ pointerId: 1 } as PointerEvent);
    expect(onReorder).toHaveBeenCalledWith([2, 1, 3]);
    expect(sortable.draggingId.value).toBeNull();
  });
});
