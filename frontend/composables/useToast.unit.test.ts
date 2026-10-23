import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToast } from './useToast';

describe('useToast', () => {
  afterEach(() => {
    vi.useRealTimers();
    const { toasts, removeToast } = useToast();
    for (const toast of [...toasts.value]) {
      removeToast(toast.id);
    }
  });

  it('queues typed toasts and removes them', () => {
    const { toasts, showError, showSuccess, showWarning, showInfo, removeToast } = useToast();
    const id = showError('Nope', 0);
    showSuccess('Saved', 0);
    showWarning('Careful', 0);
    showInfo('Heads up', 0);

    expect(toasts.value.map((toast) => toast.type)).toEqual(['error', 'success', 'warning', 'info']);
    removeToast(id);
    expect(toasts.value.some((toast) => toast.id === id)).toBe(false);
  });

  it('auto-dismisses a toast and runs an action toast', () => {
    vi.useFakeTimers();
    const { toasts, showToast, showActionToast } = useToast();
    const handler = vi.fn();
    showToast('Gone', 'info', 1000);
    const actionId = showActionToast('Undo', { label: 'Undo', handler });

    expect(toasts.value).toHaveLength(2);
    vi.advanceTimersByTime(1000);
    expect(toasts.value.map((toast) => toast.id)).toEqual([actionId]);
    toasts.value[0].action?.handler();
    expect(handler).toHaveBeenCalled();
  });
});
