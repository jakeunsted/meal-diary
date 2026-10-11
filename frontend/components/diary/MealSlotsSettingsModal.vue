<template>
  <div class="modal-box max-w-lg" data-testid="meal-slots-settings-modal">
    <h3 class="font-bold text-lg" id="meal-slots-settings-title">
      {{ $t('diarySettings.title') }}
    </h3>
    <p class="text-sm opacity-70 mt-1">{{ $t('diarySettings.subtitle') }}</p>
    <p id="meal-slots-reorder-hint" class="sr-only">
      {{ $t('diarySettings.reorderHint') }}
    </p>

    <div
      ref="listRef"
      class="meal-slots-sortable mt-4 flex flex-col gap-2"
      data-testid="meal-slots-list"
      @pointerdown="handleListPointerDown"
    >
      <div
        v-for="(slot, index) in draftSlots"
        :key="slot.clientKey"
        class="meal-slots-sortable__row flex items-center gap-1 rounded-lg border border-base-content/15 bg-base-200 p-2"
        :class="{
          'meal-slots-sortable__row--dragging': draggingId === slot.clientKey,
          'meal-slots-sortable__row--shifting':
            draggingId != null && draggingId !== slot.clientKey,
        }"
        :style="{ transform: `translateY(${rowTranslateY(slot.clientKey)}px)` }"
        data-sortable-row
        :data-sortable-id="slot.clientKey"
        :data-testid="`meal-slot-row-${index}`"
      >
        <button
          type="button"
          class="btn btn-ghost btn-xs cursor-grab touch-none"
          data-sortable-handle
          :data-testid="`meal-slot-drag-handle-${index}`"
          :aria-label="$t('diarySettings.reorder')"
          aria-describedby="meal-slots-reorder-hint"
          @click.prevent
        >
          <fa :icon="['fas', 'bars']" />
        </button>
        <input
          :value="slot.name"
          class="input input-bordered input-sm flex-1"
          :maxlength="maxNameLength"
          :aria-label="$t('diarySettings.mealNameLabelIndexed', { index: index + 1 })"
          :data-testid="`meal-slot-name-input-${index}`"
          @focus="handlePremiumGate"
          @input="handleNameInput(index, $event)"
        />
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          :data-testid="`meal-slot-move-up-${index}`"
          :aria-label="$t('diarySettings.moveUp', { name: displayName(slot, index) })"
          :disabled="index === 0 || !canCustomize"
          @click="handleMove(slot.clientKey, -1)"
        >
          <fa :icon="['fas', 'chevron-up']" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          :data-testid="`meal-slot-move-down-${index}`"
          :aria-label="$t('diarySettings.moveDown', { name: displayName(slot, index) })"
          :disabled="index >= draftSlots.length - 1 || !canCustomize"
          @click="handleMove(slot.clientKey, 1)"
        >
          <fa :icon="['fas', 'chevron-down']" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs text-error"
          :data-testid="`meal-slot-remove-${index}`"
          :aria-label="$t('diarySettings.removeMeal', { name: displayName(slot, index) })"
          :disabled="draftSlots.length <= minSlots"
          :aria-disabled="draftSlots.length <= minSlots"
          @click="handleRemove(index)"
        >
          <fa :icon="['fas', 'trash']" />
        </button>
      </div>
    </div>

    <p class="mt-4 text-xs font-semibold uppercase tracking-wide opacity-50">
      {{ $t('diarySettings.quickAdd') }}
    </p>
    <div class="mt-2 flex flex-wrap gap-2" data-testid="meal-slot-presets">
      <button
        v-for="preset in presets"
        :key="preset"
        type="button"
        class="btn btn-xs btn-outline"
        :data-testid="`meal-slot-preset-${preset}`"
        :disabled="draftSlots.length >= maxSlots"
        @click="handleApplyPreset(preset)"
      >
        + {{ preset }}
      </button>
      <button
        type="button"
        class="btn btn-xs btn-ghost text-primary"
        data-testid="meal-slot-add-button"
        :aria-label="$t('diarySettings.addMeal')"
        :disabled="draftSlots.length >= maxSlots"
        @click="handleAdd"
      >
        + {{ $t('diarySettings.customMeal') }}
      </button>
    </div>

    <div class="alert alert-info mt-4 py-2 text-sm">
      <fa :icon="['fas', 'circle-info']" />
      <span>{{ $t('diarySettings.applyFromToday') }}</span>
    </div>

    <div
      v-if="validationError"
      class="alert alert-warning mt-3 py-2 text-sm"
      role="alert"
      aria-live="polite"
      data-testid="meal-slots-validation-error"
    >
      {{ validationError }}
    </div>

    <div
      v-if="removalWarning"
      class="alert alert-warning mt-3 py-2 text-sm"
      role="status"
      aria-live="polite"
      data-testid="meal-slots-removal-warning"
    >
      {{ removalWarning }}
    </div>

    <div class="modal-action items-center justify-between">
      <form method="dialog">
        <button
          type="submit"
          class="btn btn-ghost"
          data-testid="meal-slots-cancel"
          :aria-label="$t('diarySettings.cancel')"
        >
          {{ $t('diarySettings.cancel') }}
        </button>
      </form>
      <button
        type="button"
        class="btn btn-primary min-w-24"
        data-testid="meal-slots-save"
        :disabled="saving || !!validationError"
        :aria-disabled="saving || !!validationError"
        @click="handleSave"
      >
        <span v-if="saving" class="loading loading-spinner loading-sm" />
        {{ $t('diarySettings.save') }}
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="submit" :aria-label="$t('diarySettings.dismiss')">
      {{ $t('diarySettings.dismiss') }}
    </button>
  </form>
</template>

<script setup>
import {
  MAX_MEAL_SLOT_NAME_LENGTH,
  MAX_MEAL_SLOTS,
  MEAL_SLOT_QUICK_ADD_PRESETS,
  MIN_MEAL_SLOTS,
  diffMealSlots,
  validateMealSlotNames,
} from '@meal-diary/shared';
import { useApi } from '~/composables/useApi';
import { useShoppingListSortable } from '~/composables/useShoppingListSortable';
import { useUserStore } from '~/stores/user';
import { useEntitlements } from '~/composables/useEntitlements';
import { usePaywall } from '~/composables/usePaywall';
import { useToast } from '~/composables/useToast';

const props = defineProps({
  initialSlots: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['saved']);

const { t } = useI18n();
const { track } = useAnalytics();
const { api } = useApi();
const userStore = useUserStore();
const { hasFeature } = useEntitlements();
const { openPaywall } = usePaywall();
const { showSuccess, showError } = useToast();

const minSlots = MIN_MEAL_SLOTS;
const maxSlots = MAX_MEAL_SLOTS;
const maxNameLength = MAX_MEAL_SLOT_NAME_LENGTH;
const presets = MEAL_SLOT_QUICK_ADD_PRESETS;

let clientKeyCounter = 0;
const nextClientKey = () => {
  clientKeyCounter += 1;
  return `slot-${clientKeyCounter}`;
};

const draftSlots = ref(
  (props.initialSlots.length
    ? props.initialSlots
    : [
        { id: null, name: 'Breakfast' },
        { id: null, name: 'Lunch' },
        { id: null, name: 'Dinner' },
      ]
  ).map((slot) => ({
    clientKey: nextClientKey(),
    id: slot.id ?? null,
    name: slot.name,
  }))
);

const saving = ref(false);
const pendingConfirm = ref(false);
const removalImpact = ref([]);

const canCustomize = computed(() => hasFeature('custom_meal_slots'));

const slotClientKeys = computed(() => draftSlots.value.map((slot) => slot.clientKey));

const {
  listRef,
  draggingId,
  rowTranslateY,
  handlePointerDown,
  clearDrag,
} = useShoppingListSortable({
  itemIds: slotClientKeys,
  onReorder: (orderedKeys) => {
    const byKey = new Map(draftSlots.value.map((slot) => [slot.clientKey, slot]));
    draftSlots.value = orderedKeys
      .map((key) => byKey.get(key))
      .filter(Boolean);
  },
});

const handleListPointerDown = (event) => {
  const target = event.target;
  const onHandle = Boolean(target?.closest?.('[data-sortable-handle]'));
  if (!onHandle) return;
  if (!canCustomize.value) {
    openPaywall('custom_meal_slots');
    return;
  }
  handlePointerDown(event);
};

// Dialog stays mounted when closed; clear pointer-drag locks so the diary can scroll.
const handleDialogClose = () => clearDrag();

onMounted(() => {
  document.body.style.removeProperty('touch-action');
  document.body.style.removeProperty('user-select');
  document
    .getElementById('meal_slots_settings_modal')
    ?.addEventListener('close', handleDialogClose);
});

onBeforeUnmount(() => {
  document
    .getElementById('meal_slots_settings_modal')
    ?.removeEventListener('close', handleDialogClose);
  clearDrag();
});

const validationError = computed(() => {
  const result = validateMealSlotNames(draftSlots.value);
  if (result.ok) return '';
  const first = result.errors[0];
  if (!first) {
    return t('diarySettings.invalidCount');
  }
  if (first.code === 'duplicate') return t('diarySettings.duplicateName');
  if (first.code === 'emoji') return t('diarySettings.noEmoji');
  if (first.code === 'too_long') return t('diarySettings.nameTooLong');
  if (first.code === 'empty') return t('diarySettings.nameRequired');
  return t('diarySettings.invalidName');
});

const removalWarning = computed(() => {
  if (!removalImpact.value.length) return '';
  const withContent = removalImpact.value.filter((r) => r.futureMealsWithContent > 0);
  if (withContent.length) {
    return withContent
      .map((r) =>
        t('diarySettings.removeWithContent', {
          name: r.name,
          count: r.futureMealsWithContent,
        })
      )
      .join(' ');
  }
  return t('diarySettings.removeEmpty');
});

const handlePremiumGate = () => {
  if (!canCustomize.value) {
    openPaywall('custom_meal_slots');
    return false;
  }
  return true;
};

const handleNameInput = (index, event) => {
  if (!handlePremiumGate()) {
    event.target.value = draftSlots.value[index].name;
    return;
  }
  draftSlots.value[index].name = event.target.value;
};

const displayName = (slot, index) =>
  slot.name.trim() || t('diarySettings.mealNameLabelIndexed', { index: index + 1 });

const handleRemove = (index) => {
  if (!canCustomize.value) {
    openPaywall('custom_meal_slots');
    return;
  }
  if (draftSlots.value.length <= minSlots) return;
  draftSlots.value = draftSlots.value.filter((_, i) => i !== index);
};

const handleMove = (clientKey, direction) => {
  if (!canCustomize.value) {
    openPaywall('custom_meal_slots');
    return;
  }
  const index = draftSlots.value.findIndex((slot) => slot.clientKey === clientKey);
  if (index < 0) return;
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= draftSlots.value.length) return;
  const next = [...draftSlots.value];
  const [moved] = next.splice(index, 1);
  next.splice(nextIndex, 0, moved);
  draftSlots.value = next;
};

const handleAdd = () => {
  if (!canCustomize.value) {
    openPaywall('custom_meal_slots');
    return;
  }
  if (draftSlots.value.length >= maxSlots) return;
  draftSlots.value = [
    ...draftSlots.value,
    { clientKey: nextClientKey(), id: null, name: '' },
  ];
};

const handleApplyPreset = (preset) => {
  if (!canCustomize.value) {
    openPaywall('custom_meal_slots');
    return;
  }
  const emptyIndex = draftSlots.value.findIndex((s) => !s.name.trim());
  if (emptyIndex >= 0) {
    draftSlots.value[emptyIndex].name = preset;
    return;
  }
  if (draftSlots.value.length < maxSlots) {
    draftSlots.value = [
      ...draftSlots.value,
      { clientKey: nextClientKey(), id: null, name: preset },
    ];
  }
};

const localToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const handleSave = async () => {
  if (!canCustomize.value) {
    openPaywall('custom_meal_slots');
    return;
  }
  if (validationError.value) return;

  const familyGroupId = userStore.user?.family_group_id;
  if (!familyGroupId) return;

  const payloadSlots = draftSlots.value.map((slot) => ({
    id: slot.id,
    name: slot.name,
  }));

  saving.value = true;
  try {
    await api(`/api/family-groups/${familyGroupId}/meal-slots`, {
      method: 'PUT',
      silent: true,
      body: {
        slots: payloadSlots,
        today: localToday(),
        confirm: pendingConfirm.value,
      },
    });

    track('diary_meal_slots_saved', {
      slot_count: payloadSlots.length,
    });
    showSuccess(t('diarySettings.saved'));
    emit('saved');
    document.getElementById('meal_slots_settings_modal')?.close();
    pendingConfirm.value = false;
    removalImpact.value = [];
  } catch (error) {
    const data = error?.data || error?.response?._data;
    if (data?.code === 'MEAL_SLOTS_CONFIRMATION_REQUIRED') {
      removalImpact.value = data.removed || [];
      pendingConfirm.value = true;
      return;
    }
    showError(t('diarySettings.saveFailed'));
  } finally {
    saving.value = false;
  }
};

watch(
  () => props.initialSlots,
  (slots) => {
    if (!slots?.length) return;
    draftSlots.value = slots.map((slot) => ({
      clientKey: nextClientKey(),
      id: slot.id ?? null,
      name: slot.name,
    }));
  },
  { deep: true }
);

// Local preview of removals vs initial (without future counts until API 409)
watch(
  draftSlots,
  () => {
    if (pendingConfirm.value) return;
    const diff = diffMealSlots(
      props.initialSlots.map((s) => ({ id: s.id, name: s.name })),
      draftSlots.value.map((s) => ({ id: s.id, name: s.name }))
    );
    if (diff.removed.length && !diff.requiresConfirmation) {
      removalImpact.value = diff.removed.map((r) => ({
        ...r,
        futureMealsWithContent: 0,
      }));
    } else if (!diff.removed.length) {
      removalImpact.value = [];
    }
  },
  { deep: true }
);
</script>

<style scoped>
.meal-slots-sortable__row {
  will-change: transform;
}

.meal-slots-sortable__row--shifting {
  transition: transform 120ms ease;
}

.meal-slots-sortable__row--dragging {
  position: relative;
  z-index: 20;
  opacity: 0.96;
  box-shadow: 0 8px 20px rgb(0 0 0 / 18%);
  transition: box-shadow 120ms ease, opacity 120ms ease;
  touch-action: none;
}
</style>
