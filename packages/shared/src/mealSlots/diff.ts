import type { MealSlotInput, MealSlotLike, MealSlotsDiff, RemovedSlotImpact } from './types.ts';
import { normalizeMealSlotName } from './validate.ts';

export interface DiffMealSlotsOptions {
  /** Map of slot id → count of future days (today+) with a dish or recipe in that slot. */
  futureContentBySlotId?: Record<string, number>;
}

/**
 * Compare current active slots to a proposed ordered list.
 * Proposed slots with no id (or an unknown id) are treated as adds.
 */
export const diffMealSlots = (
  current: MealSlotLike[],
  proposed: MealSlotInput[],
  options: DiffMealSlotsOptions = {}
): MealSlotsDiff => {
  const futureContentBySlotId = options.futureContentBySlotId ?? {};
  const currentById = new Map(current.map((slot) => [String(slot.id), slot]));

  const added: MealSlotInput[] = [];
  const renamed: MealSlotsDiff['renamed'] = [];
  const proposedExistingIds: string[] = [];

  for (const slot of proposed) {
    const idKey = slot.id == null || slot.id === '' ? null : String(slot.id);
    const existing = idKey ? currentById.get(idKey) : undefined;

    if (!existing) {
      added.push({
        id: slot.id ?? null,
        name: normalizeMealSlotName(slot.name),
      });
      continue;
    }

    proposedExistingIds.push(idKey!);
    const nextName = normalizeMealSlotName(slot.name);
    if (normalizeMealSlotName(existing.name) !== nextName) {
      renamed.push({ id: existing.id, from: existing.name, to: nextName });
    }
  }

  const proposedIdSet = new Set(proposedExistingIds);
  const removed: RemovedSlotImpact[] = current
    .filter((slot) => !proposedIdSet.has(String(slot.id)))
    .map((slot) => ({
      id: slot.id,
      name: slot.name,
      futureMealsWithContent: futureContentBySlotId[String(slot.id)] ?? 0,
    }));

  const currentOrder = current.map((slot) => String(slot.id));
  const sameIds =
    proposedExistingIds.length === current.length &&
    added.length === 0 &&
    removed.length === 0;
  const reordered =
    sameIds && !proposedExistingIds.every((id, index) => id === currentOrder[index]);

  return {
    added,
    removed,
    renamed,
    reordered,
    requiresConfirmation: removed.some((slot) => slot.futureMealsWithContent > 0),
  };
};
