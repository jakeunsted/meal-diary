/**
 * A fetch that started before a local edit must not replace that edit.
 * When there is nothing on screen yet, the fetched value is still used.
 */
export function resolveStaleFetch<T>(
  revisionAtStart: number,
  revisionNow: number,
  current: T | undefined,
  fetched: T
): T {
  if (revisionNow !== revisionAtStart && current !== undefined) {
    return current;
  }
  return fetched;
}
