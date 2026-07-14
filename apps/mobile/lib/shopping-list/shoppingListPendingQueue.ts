import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ShoppingListPendingOp } from '@/types/shoppingList';

const QUEUE_PREFIX = 'shopping-list-pending';

const memoryQueues = new Map<number, ShoppingListPendingOp[]>();
const listeners = new Set<() => void>();
let snapshotVersion = 0;

function buildQueueKey(familyGroupId: number): string {
  return `${QUEUE_PREFIX}:${familyGroupId}`;
}

function notifyListeners(): void {
  snapshotVersion += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeShoppingListPending(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getShoppingListPendingSnapshotVersion(): number {
  return snapshotVersion;
}

export function getPendingOpsCount(familyGroupId: number): number {
  return memoryQueues.get(familyGroupId)?.length ?? 0;
}

export function hasPendingOps(familyGroupId: number): boolean {
  return getPendingOpsCount(familyGroupId) > 0;
}

export function createPendingOpId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function remapId(
  id: number | string,
  tempIdMap: Map<string, number>
): number | string {
  if (typeof id === 'string' && tempIdMap.has(id)) {
    return tempIdMap.get(id)!;
  }
  return id;
}

/** Pure helper: rewrite temp ids in remaining ops after a successful add. */
export function remapTempIdsInOps(
  ops: ShoppingListPendingOp[],
  tempId: string,
  serverId: number
): ShoppingListPendingOp[] {
  const tempIdMap = new Map([[tempId, serverId]]);

  return ops.map((op) => {
    switch (op.type) {
      case 'add':
        return {
          ...op,
          parentItemId:
            op.parentItemId == null ? null : remapId(op.parentItemId, tempIdMap),
        };
      case 'update':
        return { ...op, itemId: remapId(op.itemId, tempIdMap) };
      case 'delete':
        return { ...op, itemId: remapId(op.itemId, tempIdMap) };
      case 'bulkUpdate':
        return {
          ...op,
          items: op.items.map((item) => ({
            ...item,
            id: remapId(item.id, tempIdMap),
          })),
        };
      case 'bulkDelete':
        return {
          ...op,
          ids: op.ids.map((id) => remapId(id, tempIdMap)),
        };
      case 'reorder':
        return {
          ...op,
          items: op.items.map((item) => ({
            ...item,
            id: remapId(item.id, tempIdMap),
            parent_item_id:
              item.parent_item_id == null
                ? null
                : remapId(item.parent_item_id, tempIdMap),
          })),
        };
      case 'bulkAdd':
        return op;
      default:
        return op;
    }
  });
}

export async function loadQueue(familyGroupId: number): Promise<ShoppingListPendingOp[]> {
  try {
    const raw = await AsyncStorage.getItem(buildQueueKey(familyGroupId));
    if (!raw) {
      memoryQueues.set(familyGroupId, []);
      notifyListeners();
      return [];
    }

    const parsed = JSON.parse(raw) as ShoppingListPendingOp[];
    if (!Array.isArray(parsed)) {
      await AsyncStorage.removeItem(buildQueueKey(familyGroupId));
      memoryQueues.set(familyGroupId, []);
      notifyListeners();
      return [];
    }

    memoryQueues.set(familyGroupId, parsed);
    notifyListeners();
    return parsed;
  } catch (error) {
    console.warn('[shoppingListPendingQueue] Failed to load queue', error);
    memoryQueues.set(familyGroupId, []);
    notifyListeners();
    return [];
  }
}

async function persistQueue(
  familyGroupId: number,
  ops: ShoppingListPendingOp[]
): Promise<void> {
  memoryQueues.set(familyGroupId, ops);
  notifyListeners();

  try {
    if (ops.length === 0) {
      await AsyncStorage.removeItem(buildQueueKey(familyGroupId));
      return;
    }
    await AsyncStorage.setItem(buildQueueKey(familyGroupId), JSON.stringify(ops));
  } catch (error) {
    console.warn('[shoppingListPendingQueue] Failed to save queue', error);
  }
}

export async function enqueuePendingOp(
  op: ShoppingListPendingOp
): Promise<ShoppingListPendingOp> {
  const familyGroupId = op.familyGroupId;
  const current = memoryQueues.get(familyGroupId) ?? (await loadQueue(familyGroupId));
  const nextOp: ShoppingListPendingOp = {
    ...op,
    opId: op.opId || createPendingOpId(),
  };
  await persistQueue(familyGroupId, [...current, nextOp]);
  return nextOp;
}

export async function replaceQueue(
  familyGroupId: number,
  ops: ShoppingListPendingOp[]
): Promise<void> {
  await persistQueue(familyGroupId, ops);
}

export async function clearPendingQueue(familyGroupId?: number): Promise<void> {
  try {
    if (familyGroupId != null) {
      memoryQueues.delete(familyGroupId);
      await AsyncStorage.removeItem(buildQueueKey(familyGroupId));
      notifyListeners();
      return;
    }

    memoryQueues.clear();
    const keys = await AsyncStorage.getAllKeys();
    const queueKeys = keys.filter((key) => key.startsWith(`${QUEUE_PREFIX}:`));
    if (queueKeys.length > 0) {
      await AsyncStorage.multiRemove(queueKeys);
    }
    notifyListeners();
  } catch (error) {
    console.warn('[shoppingListPendingQueue] Failed to clear queue', error);
  }
}

function opReferencesItemId(op: ShoppingListPendingOp, itemId: number | string): boolean {
  switch (op.type) {
    case 'add':
      return op.tempId === itemId || op.parentItemId === itemId;
    case 'update':
    case 'delete':
      return op.itemId === itemId;
    case 'bulkUpdate':
      return op.items.some((item) => item.id === itemId);
    case 'bulkDelete':
      return op.ids.includes(itemId);
    case 'reorder':
      return op.items.some(
        (item) => item.id === itemId || item.parent_item_id === itemId
      );
    case 'bulkAdd':
      return false;
    default:
      return false;
  }
}

/** Drop pending ops for a local temp item that was removed before sync. */
export async function discardPendingOpsForItem(
  familyGroupId: number,
  itemId: number | string
): Promise<void> {
  const current = memoryQueues.get(familyGroupId) ?? (await loadQueue(familyGroupId));
  const next = current.filter((op) => !opReferencesItemId(op, itemId));
  if (next.length !== current.length) {
    await persistQueue(familyGroupId, next);
  }
}
