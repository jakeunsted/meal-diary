<template>
  <div
    v-if="showPending"
    class="alert alert-info mb-4"
    role="status"
    data-testid="recipe-sync-pending"
  >
    <span>{{ $t('recipeSync.pending') }}</span>
  </div>

  <div
    v-if="recipeStore.syncFailed"
    class="alert alert-error mb-4"
    role="alert"
    data-testid="recipe-sync-failed"
  >
    <span>{{ $t('recipeSync.syncFailed') }}</span>
    <button type="button" class="btn btn-sm btn-ghost" data-testid="recipe-sync-retry" @click="handleRetry">
      {{ $t('recipeSync.retry') }}
    </button>
  </div>

  <dialog
    ref="reviewDialog"
    class="modal"
    data-testid="recipe-sync-review"
    @close="handleDialogClose"
  >
    <div v-if="recipeStore.conflicts.length" class="modal-box max-w-lg" data-testid="recipe-sync-review-panel">
      <form method="dialog">
        <button
          type="submit"
          class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          data-testid="recipe-sync-close"
          :aria-label="$t('recipeSync.close')"
        >
          ✕
        </button>
      </form>
      <h3 class="font-bold text-lg">{{ $t('recipeSync.title') }}</h3>
      <p class="mt-1 text-sm opacity-70">{{ $t('recipeSync.body') }}</p>
      <ul class="mt-4 flex flex-col gap-3">
        <li
          v-for="conflict in recipeStore.conflicts"
          :key="conflict.recipeId"
          class="rounded-lg border border-base-content/15 p-3"
          data-testid="recipe-sync-row"
        >
          <p class="text-sm" data-testid="recipe-sync-yours">
            {{ $t('recipeSync.yours') }}: {{ labelFor(conflict.yours) }}
          </p>
          <p class="text-sm" data-testid="recipe-sync-theirs">
            {{ $t('recipeSync.theirs') }}: {{ labelFor(conflict.theirs) }}
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              data-testid="recipe-sync-keep-mine"
              :disabled="recipeStore.syncing"
              @click="handleKeepMine(conflict)"
            >
              {{ $t('recipeSync.keepMine') }}
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              data-testid="recipe-sync-keep-theirs"
              :disabled="recipeStore.syncing"
              @click="handleKeepTheirs(conflict)"
            >
              {{ $t('recipeSync.keepTheirs') }}
            </button>
          </div>
        </li>
      </ul>
      <div v-if="recipeStore.conflicts.length > 1" class="modal-action">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          data-testid="recipe-sync-keep-all-mine"
          :disabled="recipeStore.syncing"
          @click="handleKeepAllMine"
        >
          {{ $t('recipeSync.keepAllMine') }}
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          data-testid="recipe-sync-keep-all-theirs"
          :disabled="recipeStore.syncing"
          @click="handleKeepAllTheirs"
        >
          {{ $t('recipeSync.keepAllTheirs') }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="submit">{{ $t('recipeSync.close') }}</button>
    </form>
  </dialog>
</template>

<script setup>
import { recipeSyncChangeLabel } from '@meal-diary/shared';
import { useRecipeStore } from '~/stores/recipe';

const recipeStore = useRecipeStore();
const reviewDialog = ref(null);
let ignoreClose = false;

const showPending = computed(() =>
  recipeStore.pendingEdits.length > 0 && recipeStore.conflicts.length === 0
);

const labelFor = (value) => recipeSyncChangeLabel(value);

const handleRetry = () => {
  void recipeStore.flushPending();
};

const handleKeepMine = (conflict) => {
  void recipeStore.keepMine(conflict);
};

const handleKeepTheirs = (conflict) => {
  recipeStore.keepTheirs(conflict);
};

const handleKeepAllMine = () => {
  void recipeStore.keepAllMine();
};

const handleKeepAllTheirs = () => {
  recipeStore.keepAllTheirs();
};

const handleDialogClose = () => {
  if (ignoreClose) {
    ignoreClose = false;
    return;
  }
  if (recipeStore.conflicts.length > 0) {
    recipeStore.keepAllTheirs();
  }
};

const handleOnline = () => {
  void recipeStore.flushPending();
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    void recipeStore.flushPending();
  }
};

watch(
  () => recipeStore.conflicts.length,
  async (count) => {
    await nextTick();
    const dialog = reviewDialog.value;
    if (!dialog) {
      return;
    }
    if (count > 0) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }
    if (dialog.open) {
      ignoreClose = true;
      dialog.close();
    }
  }
);

onMounted(() => {
  recipeStore.hydrateFromStorage();
  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  void recipeStore.flushPending();
});

onBeforeUnmount(() => {
  window.removeEventListener('online', handleOnline);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>
