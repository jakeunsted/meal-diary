const revisions = new Map<string, number>();

function revisionKey(familyGroupId: number, weekKey: string): string {
  return `${familyGroupId}:${weekKey}`;
}

export function readMealDiaryFetchRevision(familyGroupId: number, weekKey: string): number {
  return revisions.get(revisionKey(familyGroupId, weekKey)) ?? 0;
}

export function bumpMealDiaryFetchRevision(familyGroupId: number, weekKey: string): void {
  const key = revisionKey(familyGroupId, weekKey);
  revisions.set(key, (revisions.get(key) ?? 0) + 1);
}

export function resetMealDiaryFetchRevisions(): void {
  revisions.clear();
}
