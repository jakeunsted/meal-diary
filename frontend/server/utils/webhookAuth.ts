import { createHash, timingSafeEqual } from 'node:crypto';

export const DAILY_MEAL_WEBHOOK_EVENTS = new Set(['update-daily-meal']);

export const SHOPPING_LIST_WEBHOOK_EVENTS = new Set([
  'add-item',
  'delete-item',
  'check-item',
  'uncheck-item',
  'move-item',
]);

/**
 * Compare a shared webhook secret without leaking the expected value through compare timing.
 * Both sides are hashed first so the compare length does not depend on the caller input.
 */
export const webhookSecretsMatch = (expected: string | undefined, provided: string | undefined): boolean => {
  if (!expected || !provided) {
    return false;
  }

  const expectedHash = createHash('sha256').update(expected).digest();
  const providedHash = createHash('sha256').update(provided).digest();
  return timingSafeEqual(expectedHash, providedHash);
};
