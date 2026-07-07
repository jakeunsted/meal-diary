import { useCallback } from 'react';

import { canEditMealWeek, isWeekAheadAllowed } from '@/lib/diary/weekEntitlements';
import type { ResolvedEntitlements } from '@/types/api';

export function useDiaryEntitlements(entitlements: ResolvedEntitlements | undefined) {
  const limits = entitlements?.limits;

  const canNavigateToWeek = useCallback(
    (weekStart: Date, referenceDate: Date = new Date()) => {
      const maxWeeksAhead = limits?.maxWeeksAhead ?? Number.POSITIVE_INFINITY;
      return isWeekAheadAllowed(weekStart, maxWeeksAhead, referenceDate);
    },
    [limits?.maxWeeksAhead]
  );

  const canEditWeek = useCallback(
    (weekStart: Date, referenceDate: Date = new Date()) => {
      const maxWeeksAhead = limits?.maxWeeksAhead ?? Number.POSITIVE_INFINITY;
      const canEditPastWeeks = limits?.canEditPastWeeks ?? true;
      return canEditMealWeek(weekStart, maxWeeksAhead, canEditPastWeeks, referenceDate);
    },
    [limits?.canEditPastWeeks, limits?.maxWeeksAhead]
  );

  const isWeekReadOnly = useCallback(
    (weekStart: Date, referenceDate: Date = new Date()) => {
      return canNavigateToWeek(weekStart, referenceDate) && !canEditWeek(weekStart, referenceDate);
    },
    [canEditWeek, canNavigateToWeek]
  );

  return {
    canNavigateToWeek,
    canEditWeek,
    isWeekReadOnly,
    billing: entitlements?.billing,
  };
}
