import type { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/errors';
import { ShoppingListOfflineQueuedError } from '@/lib/shopping-list/shoppingListOfflineError';
import { isShoppingListDeviceOnline } from '@/lib/shopping-list/shoppingListNetwork';
import {
  loadShoppingListCache,
  markShoppingListDirty,
} from '@/lib/shopping-list/shoppingListStorage';

async function keepShoppingListWriteLocal(
  queryClient: QueryClient,
  familyGroupId: number,
  scheduleFlush: boolean
): Promise<never> {
  await markShoppingListDirty(familyGroupId);
  const { setShoppingListDirtyStatus, flushShoppingListPendingOps } = await import(
    '@/lib/shopping-list/shoppingListSync'
  );
  setShoppingListDirtyStatus(familyGroupId, true);
  if (scheduleFlush) {
    void flushShoppingListPendingOps(queryClient, familyGroupId);
  }
  throw new ShoppingListOfflineQueuedError();
}

/**
 * Run a shopping-list write, or keep the on-screen list when the device is offline
 * or the request fails before the API returns an error.
 */
export async function commitShoppingListWrite<T>(
  queryClient: QueryClient,
  familyGroupId: number,
  request: () => Promise<T>
): Promise<T> {
  const cached = await loadShoppingListCache(familyGroupId);
  const online = await isShoppingListDeviceOnline();

  if (!online || cached?.dirty) {
    return keepShoppingListWriteLocal(queryClient, familyGroupId, online);
  }

  try {
    return await request();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    return keepShoppingListWriteLocal(queryClient, familyGroupId, true);
  }
}
