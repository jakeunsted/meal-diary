import { describe, expect, it, beforeEach } from 'vitest';

import { resolveStaleFetch } from '@meal-diary/shared';

import {
  bumpMealDiaryFetchRevision,
  readMealDiaryFetchRevision,
  resetMealDiaryFetchRevisions,
} from '@/lib/diary/mealDiaryFetchRevision';

describe('meal diary fetch revision', () => {
  beforeEach(() => {
    resetMealDiaryFetchRevisions();
  });

  it('keeps a local edit when the week fetch started before that edit', () => {
    const revisionAtStart = readMealDiaryFetchRevision(4, '2026-10-19');
    bumpMealDiaryFetchRevision(4, '2026-10-19');

    const result = resolveStaleFetch(
      revisionAtStart,
      readMealDiaryFetchRevision(4, '2026-10-19'),
      [{ breakfast: 'Eggs' }],
      [{ breakfast: 'Server' }]
    );

    expect(result).toEqual([{ breakfast: 'Eggs' }]);
  });

  it('uses the fetched week when nothing was edited while it was loading', () => {
    const revision = readMealDiaryFetchRevision(4, '2026-10-19');
    expect(resolveStaleFetch(revision, revision, [{ breakfast: 'Toast' }], [{ breakfast: 'Server' }]))
      .toEqual([{ breakfast: 'Server' }]);
  });
});
