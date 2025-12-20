export type ToastType = 'error' | 'success' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

const toasts = ref<Toast[]>([]);

/**
 * Composable for managing toast notifications
 */
export const useToast = () => {
  /**
   * Remove a toast from the queue
   */
  const removeToast = (id: string) => {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  };

  /**
   * Show a toast notification
   */
  const showToast = (message: string, type: ToastType, duration: number = 5000) => {
    const id = `${Date.now()}-${Math.random()}`;
    const toast: Toast = {
      id,
      message,
      type,
      duration
    };

    toasts.value.push(toast);

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  };

  /**
   * Show an error toast
   */
  const showError = (message: string, duration: number = 5000) => {
    return showToast(message, 'error', duration);
  };

  /**
   * Show a success toast
   */
  const showSuccess = (message: string, duration: number = 3000) => {
    return showToast(message, 'success', duration);
  };

  /**
   * Show a warning toast
   */
  const showWarning = (message: string, duration: number = 4000) => {
    return showToast(message, 'warning', duration);
  };

  /**
   * Show an info toast
   */
  const showInfo = (message: string, duration: number = 3000) => {
    return showToast(message, 'info', duration);
  };

  return {
    toasts: readonly(toasts),
    showError,
    showSuccess,
    showWarning,
    showInfo,
    removeToast
  };
};

