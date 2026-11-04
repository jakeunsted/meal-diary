import {
  OFFLINE_REQUEST_TIMEOUT_MS,
  overlayRecipe,
  replaceById,
  toRecipeSyncValue,
  type RecipeSyncValue,
} from '@meal-diary/shared';
import type { QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

import { apiFetch } from '@/lib/api/client';
import { isNetworkError } from '@/lib/auth/httpError';
import { getEntitlementFeatureFromError } from '@/lib/entitlements/entitlementErrors';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { isMealDiaryNetworkOnline } from '@/lib/diary/mealDiarySync';
import { overlayRecipeList } from '@/lib/recipe/overlayRecipe';
import {
  getRecipePendingEdits,
  loadRecipePendingQueue,
  recordRecipePendingEdit,
  removeRecipePendingEdit,
  type RecipePendingEdit,
} from '@/lib/recipe/recipePendingQueue';
import { bumpRecipeFetches } from '@/lib/recipe/recipeFetchRevision';
import {
  loadFamilyRecipesCache,
  saveFamilyRecipesCache,
} from '@/lib/recipe/recipeStorage';
import { recipeKeys, updateRecipe } from '@/lib/queries/recipes';
import type { Recipe, UpdateRecipePayload } from '@/types/recipe';

export interface RecipeSyncConflict {
  recipeId: number;
  yours: RecipeSyncValue;
  theirs: RecipeSyncValue;
  baseline: RecipeSyncValue;
  serverRecipe: Recipe | null;
}

export interface RecipeSyncStatus {
  isFlushing: boolean;
  syncError: boolean;
  pendingCount: number;
}

interface SyncResponse {
  status: string;
  yours?: RecipeSyncValue;
  theirs?: RecipeSyncValue;
  baseline?: RecipeSyncValue;
  recipe?: Recipe | null;
}

const conflictsByFamily = new Map<number, RecipeSyncConflict[]>();
const statusByFamily = new Map<number, RecipeSyncStatus>();
const listeners = new Set<() => void>();
const flushLocks = new Set<number>();
let snapshotVersion = 0;
let deviceOnline = true;

function notify(): void {
  snapshotVersion += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeRecipeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRecipeSyncVersion(): number {
  return snapshotVersion;
}

export function getRecipeSyncStatus(familyGroupId: number | undefined): RecipeSyncStatus {
  if (!familyGroupId) {
    return { isFlushing: false, syncError: false, pendingCount: 0 };
  }
  return statusByFamily.get(familyGroupId) ?? {
    isFlushing: false,
    syncError: false,
    pendingCount: getRecipePendingEdits(familyGroupId).length,
  };
}

export function getRecipeConflicts(familyGroupId: number | undefined): RecipeSyncConflict[] {
  if (!familyGroupId) {
    return [];
  }
  return conflictsByFamily.get(familyGroupId) ?? [];
}

export function setRecipeDeviceOnline(isOnline: boolean): void {
  deviceOnline = isOnline;
}

function patchStatus(familyGroupId: number, patch: Partial<RecipeSyncStatus>): void {
  const current = getRecipeSyncStatus(familyGroupId);
  statusByFamily.set(familyGroupId, {
    ...current,
    ...patch,
    pendingCount: getRecipePendingEdits(familyGroupId).length,
  });
  notify();
}

async function readDeviceOnline(): Promise<boolean> {
  try {
    return isMealDiaryNetworkOnline(await Network.getNetworkStateAsync());
  } catch {
    return deviceOnline;
  }
}

function showRecipe(
  queryClient: QueryClient,
  familyGroupId: number,
  recipe: Recipe
): void {
  queryClient.setQueryData(recipeKeys.detail(recipe.id), recipe);
  queryClient.setQueryData<Recipe[] | undefined>(recipeKeys.family(familyGroupId), (current) => {
    if (!current) {
      return current;
    }
    return replaceById(current, recipe);
  });
}

async function publishServerRecipe(
  queryClient: QueryClient,
  recipe: Recipe
): Promise<void> {
  const familyGroupId = recipe.family_group_id;
  const cached = await loadFamilyRecipesCache(familyGroupId);
  const serverList = cached ? replaceById(cached, recipe) : null;
  if (serverList) {
    await saveFamilyRecipesCache(familyGroupId, serverList);
  }
  const pending = await loadRecipePendingQueue(familyGroupId);
  const queryList = queryClient.getQueryData<Recipe[]>(recipeKeys.family(familyGroupId));
  const shownList = serverList ?? (queryList?.length ? replaceById(queryList, recipe) : null);
  if (shownList) {
    queryClient.setQueryData(recipeKeys.family(familyGroupId), overlayRecipeList(shownList, pending));
  }
  const edit = pending.find((item) => item.recipeId === recipe.id);
  queryClient.setQueryData(
    recipeKeys.detail(recipe.id),
    edit ? overlayRecipe(recipe, edit.recipe) : recipe
  );
}

async function queueEdit(
  queryClient: QueryClient,
  familyGroupId: number,
  recipeId: number,
  baseline: RecipeSyncValue,
  yours: RecipeSyncValue,
  current: Recipe | null
): Promise<Recipe | null> {
  bumpRecipeFetches(familyGroupId, recipeId);
  await recordRecipePendingEdit(familyGroupId, { recipeId, baseline, recipe: yours });
  const base = current
    ?? queryClient.getQueryData<Recipe>(recipeKeys.detail(recipeId))
    ?? null;
  const shown = base ? overlayRecipe(base, yours) : null;
  if (shown) {
    showRecipe(queryClient, familyGroupId, shown);
  }
  patchStatus(familyGroupId, {});
  return shown;
}

export async function saveRecipeEdit(
  queryClient: QueryClient,
  input: {
    familyGroupId: number;
    recipeId: number;
    payload: UpdateRecipePayload;
    baseline: RecipeSyncValue | null;
    current: Recipe | null;
  }
): Promise<Recipe | null> {
  const current = input.current
    ?? queryClient.getQueryData<Recipe>(recipeKeys.detail(input.recipeId))
    ?? null;
  const yours = toRecipeSyncValue({
    ...current,
    ...input.payload,
    category_ids: input.payload.category_ids
      ?? current?.categories?.map((category) => category.id),
  });
  const baseline = input.baseline ?? (current ? toRecipeSyncValue(current) : yours);
  const pending = getRecipePendingEdits(input.familyGroupId)
    .some((edit) => edit.recipeId === input.recipeId);

  if (Platform.OS === 'android' && (!deviceOnline || pending)) {
    const shown = await queueEdit(
      queryClient,
      input.familyGroupId,
      input.recipeId,
      baseline,
      yours,
      current
    );
    if (deviceOnline) {
      void flushRecipePending(queryClient, input.familyGroupId);
    }
    return shown;
  }

  try {
    const saved = await updateRecipe(input.recipeId, input.payload);
    bumpRecipeFetches(input.familyGroupId, input.recipeId);
    await removeRecipePendingEdit(input.familyGroupId, input.recipeId);
    conflictsByFamily.set(
      input.familyGroupId,
      getRecipeConflicts(input.familyGroupId).filter((item) => item.recipeId !== input.recipeId)
    );
    await publishServerRecipe(queryClient, saved);
    patchStatus(input.familyGroupId, {});
    return saved;
  } catch (error) {
    if (Platform.OS === 'android' && isNetworkError(error)) {
      return queueEdit(
        queryClient,
        input.familyGroupId,
        input.recipeId,
        baseline,
        yours,
        current
      );
    }
    throw error;
  }
}

function consumeSyncResult(
  familyGroupId: number,
  edit: RecipePendingEdit,
  result: SyncResponse
): 'applied' | 'conflict' | 'kept' {
  if (result.status === 'applied' || result.status === 'already_saved' || result.status === 'not_found') {
    return 'applied';
  }
  if (result.status === 'conflict' && result.yours && result.theirs && result.baseline) {
    const next = getRecipeConflicts(familyGroupId).filter((item) => item.recipeId !== edit.recipeId);
    next.push({
      recipeId: edit.recipeId,
      yours: result.yours,
      theirs: result.theirs,
      baseline: result.baseline,
      serverRecipe: result.recipe ?? null,
    });
    conflictsByFamily.set(familyGroupId, next);
    notify();
    return 'conflict';
  }
  return 'kept';
}

async function finishApplied(
  queryClient: QueryClient,
  familyGroupId: number,
  edit: RecipePendingEdit,
  result: SyncResponse
): Promise<void> {
  await removeRecipePendingEdit(familyGroupId, edit.recipeId);
  conflictsByFamily.set(
    familyGroupId,
    getRecipeConflicts(familyGroupId).filter((item) => item.recipeId !== edit.recipeId)
  );
  if (result.recipe) {
    bumpRecipeFetches(familyGroupId, result.recipe.id);
    await publishServerRecipe(queryClient, result.recipe);
  }
}

export async function flushRecipePending(
  queryClient: QueryClient,
  familyGroupId: number
): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  if (flushLocks.has(familyGroupId)) {
    return;
  }
  flushLocks.add(familyGroupId);
  patchStatus(familyGroupId, { isFlushing: true, syncError: false });
  try {
    const online = await readDeviceOnline();
    deviceOnline = online;
    if (!online) {
      return;
    }
    const pending = await loadRecipePendingQueue(familyGroupId);
    const blocked = new Set(getRecipeConflicts(familyGroupId).map((item) => item.recipeId));
    for (const edit of pending) {
      if (blocked.has(edit.recipeId)) {
        continue;
      }
      try {
        const result = await apiFetch<SyncResponse>(`/recipes/${edit.recipeId}/sync`, {
          method: 'POST',
          timeoutMs: OFFLINE_REQUEST_TIMEOUT_MS,
          body: {
            baseline: edit.baseline,
            recipe: edit.recipe,
          },
        });
        const outcome = consumeSyncResult(familyGroupId, edit, result);
        if (outcome === 'applied') {
          await finishApplied(queryClient, familyGroupId, edit, result);
        }
      } catch (error) {
        const feature = getEntitlementFeatureFromError(error);
        if (feature) {
          usePaywallStore.getState().openPaywall(feature);
          return;
        }
        if (isNetworkError(error)) {
          deviceOnline = false;
          return;
        }
        patchStatus(familyGroupId, { syncError: true });
        return;
      }
    }
  } finally {
    flushLocks.delete(familyGroupId);
    patchStatus(familyGroupId, { isFlushing: false });
  }
}

export async function keepRecipeMine(
  queryClient: QueryClient,
  familyGroupId: number,
  conflict: RecipeSyncConflict
): Promise<void> {
  patchStatus(familyGroupId, { isFlushing: true, syncError: false });
  try {
    const result = await apiFetch<SyncResponse>(`/recipes/${conflict.recipeId}/sync/resolve`, {
      method: 'POST',
      timeoutMs: OFFLINE_REQUEST_TIMEOUT_MS,
      body: {
        baseline: conflict.baseline,
        expected: conflict.theirs,
        recipe: conflict.yours,
      },
    });
    const edit = getRecipePendingEdits(familyGroupId).find((item) => item.recipeId === conflict.recipeId)
      ?? { recipeId: conflict.recipeId, baseline: conflict.baseline, recipe: conflict.yours };
    const outcome = consumeSyncResult(familyGroupId, edit, result);
    if (outcome === 'applied') {
      await finishApplied(queryClient, familyGroupId, edit, result);
    }
  } catch (error) {
    const feature = getEntitlementFeatureFromError(error);
    if (feature) {
      usePaywallStore.getState().openPaywall(feature);
      return;
    }
    if (!isNetworkError(error)) {
      patchStatus(familyGroupId, { syncError: true });
    }
  } finally {
    patchStatus(familyGroupId, { isFlushing: false });
  }
}

export async function keepRecipeTheirs(
  queryClient: QueryClient,
  familyGroupId: number,
  conflict: RecipeSyncConflict
): Promise<void> {
  bumpRecipeFetches(familyGroupId, conflict.recipeId);
  await removeRecipePendingEdit(familyGroupId, conflict.recipeId);
  conflictsByFamily.set(
    familyGroupId,
    getRecipeConflicts(familyGroupId).filter((item) => item.recipeId !== conflict.recipeId)
  );
  if (conflict.serverRecipe) {
    await publishServerRecipe(queryClient, conflict.serverRecipe);
  } else {
    const current = queryClient.getQueryData<Recipe>(recipeKeys.detail(conflict.recipeId));
    if (current) {
      showRecipe(queryClient, familyGroupId, overlayRecipe(current, conflict.theirs));
    }
  }
  patchStatus(familyGroupId, {});
}

export async function keepAllRecipesMine(
  queryClient: QueryClient,
  familyGroupId: number
): Promise<void> {
  for (const conflict of [...getRecipeConflicts(familyGroupId)]) {
    await keepRecipeMine(queryClient, familyGroupId, conflict);
  }
}

export async function keepAllRecipesTheirs(
  queryClient: QueryClient,
  familyGroupId: number
): Promise<void> {
  for (const conflict of [...getRecipeConflicts(familyGroupId)]) {
    await keepRecipeTheirs(queryClient, familyGroupId, conflict);
  }
}

