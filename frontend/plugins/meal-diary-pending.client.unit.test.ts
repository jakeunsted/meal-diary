import { nextTick, reactive } from 'vue';
import { describe, expect, it, vi } from 'vitest';

const user = reactive({ family_group_id: null as number | null });
const dropUnmatchedPending = vi.fn();

vi.mock('~/stores/user', () => ({
  useUserStore: () => ({ user }),
}));

vi.mock('~/stores/mealDiary', () => ({
  useMealDiaryStore: () => ({ dropUnmatchedPending }),
}));

import plugin from './meal-diary-pending.client';

describe('meal-diary-pending plugin', () => {
  it('drops queued edits when the signed-in family is known', async () => {
    vi.stubGlobal('useUserStore', () => ({ user }));
    vi.stubGlobal('useMealDiaryStore', () => ({ dropUnmatchedPending }));

    plugin();
    user.family_group_id = 4;
    await nextTick();

    expect(dropUnmatchedPending).toHaveBeenCalledWith(4);
  });
});
