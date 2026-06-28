export type ToastType = 'error' | 'success' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  handler: () => void | Promise<void>;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
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
  const showToast = (message: string, type: ToastType, duration: number = 5000, action?: ToastAction) => {
    const id = `${Date.now()}-${Math.random()}`;
    const toast: Toast = {
      id,
      message,
      type,
      duration,
      action
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
   * Show a toast with an action button (e.g. an Undo snackbar)
   */
  const showActionToast = (
    message: string,
    action: ToastAction,
    type: ToastType = 'info',
    duration: number = 6000
  ) => {
    return showToast(message, type, duration, action);
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
    showToast,
    showActionToast,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    removeToast
  };
};

