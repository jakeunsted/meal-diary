<template>
  <div class="modal-box max-w-lg" data-testid="diary-sync-review-panel">
    <form method="dialog">
      <button
        type="submit"
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        data-testid="diary-sync-close"
        :aria-label="$t('diarySync.close')"
      >
        ✕
      </button>
    </form>
    <h3 class="font-bold text-lg">{{ $t('diarySync.title') }}</h3>
    <p class="mt-1 text-sm opacity-70">{{ $t('diarySync.body') }}</p>

    <ul class="mt-4 flex flex-col gap-3">
      <li
        v-for="row in sortedRows"
        :key="`${row.day_of_week}-${row.meal_slot_id}`"
        class="rounded-lg border border-base-content/15 p-3"
        data-testid="diary-sync-row"
      >
        <p class="font-medium">
          {{ getDayName(row.day_of_week, row.week_start_date) }}
          <span v-if="row.slot_name"> · {{ row.slot_name }}</span>
        </p>
        <p class="mt-1 text-sm" data-testid="diary-sync-yours">
          {{ $t('diarySync.yours') }}: {{ displayDish(row.yours.dish) }}
        </p>
        <p class="text-sm" data-testid="diary-sync-theirs">
          {{ $t('diarySync.theirs') }}: {{ displayDish(row.theirs.dish) }}
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            data-testid="diary-sync-keep-mine"
            :disabled="busy"
            @click="handleKeepMine(row)"
          >
            {{ $t('diarySync.keepMine') }}
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            data-testid="diary-sync-keep-theirs"
            :disabled="busy"
            @click="handleKeepTheirs(row)"
          >
            {{ $t('diarySync.keepTheirs') }}
          </button>
        </div>
      </li>
    </ul>

    <div class="modal-action">
      <button
        type="button"
        class="btn btn-primary btn-sm"
        data-testid="diary-sync-keep-all-mine"
        :disabled="busy"
        @click="handleKeepAllMine"
      >
        {{ $t('diarySync.keepAllMine') }}
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        data-testid="diary-sync-keep-all-theirs"
        :disabled="busy"
        @click="handleKeepAllTheirs"
      >
        {{ $t('diarySync.keepAllTheirs') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { normalizeMealDiaryDish } from '@meal-diary/shared';
import type { MealDiarySyncConflict } from '~/types/MealDiary';
import { useDateUtils } from '~/composables/useDateUtils';

const props = defineProps<{
  conflicts: MealDiarySyncConflict[];
  busy?: boolean;
}>();

const emit = defineEmits<{
  keepMine: [conflict: MealDiarySyncConflict];
  keepTheirs: [conflict: MealDiarySyncConflict];
  keepAllMine: [];
  keepAllTheirs: [];
}>();

const { t } = useI18n();
const { getDayName } = useDateUtils();

const sortedRows = computed(() =>
  [...props.conflicts].sort((left, right) => {
    if (left.day_of_week !== right.day_of_week) {
      return left.day_of_week - right.day_of_week;
    }
    return left.meal_slot_id - right.meal_slot_id;
  })
);

const displayDish = (dish: string | null) => normalizeMealDiaryDish(dish) ?? t('diarySync.emptyDish');

const handleKeepMine = (row: MealDiarySyncConflict) => {
  emit('keepMine', row);
};

const handleKeepTheirs = (row: MealDiarySyncConflict) => {
  emit('keepTheirs', row);
};

const handleKeepAllMine = () => {
  emit('keepAllMine');
};

const handleKeepAllTheirs = () => {
  emit('keepAllTheirs');
};
</script>
