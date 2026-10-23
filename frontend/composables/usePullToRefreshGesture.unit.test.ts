import { describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({
  mounted: [] as Array<() => void>,
  unmounted: [] as Array<() => void>,
}));

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue');
  return {
    ...actual,
    onMounted: (hook: () => void) => {
      hooks.mounted.push(hook);
    },
    onUnmounted: (hook: () => void) => {
      hooks.unmounted.push(hook);
    },
  };
});

vi.mock('~/composables/useToast', () => ({
  useToast: () => ({ showError: vi.fn() }),
}));

import { usePullToRefreshGesture } from './usePullToRefreshGesture';

describe('usePullToRefreshGesture', () => {
  it('refreshes after a pull and ignores a dialog', () => {
    class Element {
      closest() {
        return null;
      }
    }
    vi.stubGlobal('Element', Element);
    const dialog = new Element();
    dialog.closest = () => dialog;
    const page = new Element();
    const listeners = new Map<string, (event: Event) => void>();
    const onRefresh = vi.fn();
    vi.stubGlobal('window', {
      addEventListener: (type: string, listener: (event: Event) => void) => listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    });
    vi.stubGlobal('document', {
      scrollingElement: { scrollTop: 0 },
      documentElement: { scrollTop: 0 },
    });
    globalThis.__NUXT_SERVER__ = false;

    const gesture = usePullToRefreshGesture({ enabled: true, onRefresh });
    hooks.mounted.at(-1)?.();

    listeners.get('touchstart')?.({
      target: dialog,
      touches: [{ clientY: 10 }],
    } as unknown as Event);
    expect(gesture.isPulling.value).toBe(false);

    listeners.get('touchstart')?.({
      target: page,
      touches: [{ clientY: 10 }],
      preventDefault: vi.fn(),
    } as unknown as Event);
    expect(gesture.isPulling.value).toBe(true);

    listeners.get('touchmove')?.({
      touches: [{ clientY: 220 }],
      preventDefault: vi.fn(),
    } as unknown as Event);
    expect(gesture.pull.value).toBeGreaterThan(0);

    listeners.get('touchend')?.({} as Event);
    expect(onRefresh).toHaveBeenCalled();
    expect(gesture.pull.value).toBe(0);
  });
});
