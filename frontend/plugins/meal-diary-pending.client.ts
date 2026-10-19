import { useMealDiaryStore } from '~/stores/mealDiary';
import { useUserStore } from '~/stores/user';

/**
 * Drops queued diary edits when the signed-in family is no longer the one that wrote them.
 */
export default defineNuxtPlugin(() => {
  const userStore = useUserStore();
  const mealDiaryStore = useMealDiaryStore();

  watch(
    () => userStore.user?.family_group_id ?? null,
    (familyId) => {
      if (familyId == null) {
        return;
      }
      void mealDiaryStore.dropUnmatchedPending(familyId);
    }
  );
});
