import { isNetworkError } from '@/lib/auth/httpError';

export class ShoppingListOfflineQueuedError extends Error {
  readonly tempId?: string;

  constructor(tempId?: string) {
    super('Shopping list change queued offline');
    this.name = 'ShoppingListOfflineQueuedError';
    this.tempId = tempId;
  }
}

export function isShoppingListOfflineQueuedError(
  error: unknown
): error is ShoppingListOfflineQueuedError {
  return error instanceof ShoppingListOfflineQueuedError;
}

/** Optimistic UI should stay when the write was queued or the network dropped. */
export function shouldRollbackShoppingListOptimistic(error: unknown): boolean {
  return !isShoppingListOfflineQueuedError(error) && !isNetworkError(error);
}
