import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeRecipePendingEdit, type RecipeSyncValue } from '@meal-diary/shared';

const QUEUE_PREFIX = 'recipe-pending';

export interface RecipePendingEdit {
  recipeId: number;
  baseline: RecipeSyncValue;
  recipe: RecipeSyncValue;
}

const memoryQueues = new Map<number, RecipePendingEdit[]>();
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

function isSyncValue(value: unknown): value is RecipeSyncValue {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Partial<RecipeSyncValue>;
  return typeof record.name === 'string'
    && Array.isArray(record.ingredients)
    && Array.isArray(record.category_ids);
}

function normalizePendingEdit(value: unknown): RecipePendingEdit | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const edit = value as Partial<RecipePendingEdit>;
  if (typeof edit.recipeId !== 'number' || !isSyncValue(edit.baseline) || !isSyncValue(edit.recipe)) {
    return null;
  }
  return {
    recipeId: edit.recipeId,
    baseline: edit.baseline,
    recipe: edit.recipe,
  };
}

export function subscribeRecipePending(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRecipePendingSnapshotVersion(): number {
  return snapshotVersion;
}

export function getRecipePendingEdits(familyGroupId: number): RecipePendingEdit[] {
  return memoryQueues.get(familyGroupId) ?? [];
}

export async function loadRecipePendingQueue(familyGroupId: number): Promise<RecipePendingEdit[]> {
  const cached = memoryQueues.get(familyGroupId);
  if (cached) {
    return cached;
  }

  try {
    const raw = await AsyncStorage.getItem(buildQueueKey(familyGroupId));
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    const edits = Array.isArray(parsed)
      ? parsed.map(normalizePendingEdit).filter((edit): edit is RecipePendingEdit => edit != null)
      : [];
    memoryQueues.set(familyGroupId, edits);
    return edits;
  } catch (error) {
    console.warn('[recipePendingQueue] Failed to load queue', error);
    memoryQueues.set(familyGroupId, []);
    return [];
  }
}

async function persistQueue(familyGroupId: number, edits: RecipePendingEdit[]): Promise<void> {
  memoryQueues.set(familyGroupId, edits);
  if (edits.length === 0) {
    await AsyncStorage.removeItem(buildQueueKey(familyGroupId));
  } else {
    await AsyncStorage.setItem(buildQueueKey(familyGroupId), JSON.stringify(edits));
  }
  notifyListeners();
}

export async function recordRecipePendingEdit(
  familyGroupId: number,
  edit: RecipePendingEdit
): Promise<RecipePendingEdit | null> {
  const current = await loadRecipePendingQueue(familyGroupId);
  const next = mergeRecipePendingEdit(current, edit);
  await persistQueue(familyGroupId, next);
  return next.find((item) => item.recipeId === edit.recipeId) ?? null;
}

export async function removeRecipePendingEdit(
  familyGroupId: number,
  recipeId: number
): Promise<void> {
  const current = await loadRecipePendingQueue(familyGroupId);
  await persistQueue(
    familyGroupId,
    current.filter((item) => item.recipeId !== recipeId)
  );
}

export async function clearRecipePendingQueues(): Promise<void> {
  memoryQueues.clear();
  notifyListeners();
}
