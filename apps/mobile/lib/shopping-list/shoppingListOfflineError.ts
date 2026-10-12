import { isNetworkError } from '@/lib/auth/httpError';

export class ShoppingListOfflineQueuedError extends Error {
  readonly tempId?: string;

  constructor(tempId?: string) {
    super('Shopping list change queued offline');
    this.name = 'ShoppingListOfflineQueuedError';
    this.tempId = tempId;
    // Hermes can drop the custom prototype, so instanceof is not enough on device.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isShoppingListOfflineQueuedError(
  error: unknown
): error is ShoppingListOfflineQueuedError {
  if (error instanceof ShoppingListOfflineQueuedError) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === 'ShoppingListOfflineQueuedError' ||
    error.message === 'Shopping list change queued offline'
  );
}

/** Optimistic UI should stay when the write was queued or the network dropped. */
export function shouldRollbackShoppingListOptimistic(error: unknown): boolean {
  return !isShoppingListOfflineQueuedError(error) && !isNetworkError(error);
}
