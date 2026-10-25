import { describe, expect, it } from 'vitest';
import {
  DAILY_MEAL_WEBHOOK_EVENTS,
  SHOPPING_LIST_WEBHOOK_EVENTS,
  webhookSecretsMatch,
} from './webhookAuth';

describe('webhook auth', () => {
  it('matches only the configured secret', () => {
    expect(webhookSecretsMatch('local-secret', 'local-secret')).toBe(true);
    expect(webhookSecretsMatch('local-secret', 'other-secret')).toBe(false);
    expect(webhookSecretsMatch('', 'local-secret')).toBe(false);
    expect(webhookSecretsMatch('local-secret', undefined)).toBe(false);
  });

  it('allows the meal and shopping event types the family channel already uses', () => {
    expect(DAILY_MEAL_WEBHOOK_EVENTS.has('update-daily-meal')).toBe(true);
    expect(DAILY_MEAL_WEBHOOK_EVENTS.has('token-refresh')).toBe(false);
    expect(SHOPPING_LIST_WEBHOOK_EVENTS.has('add-item')).toBe(true);
    expect(SHOPPING_LIST_WEBHOOK_EVENTS.has('token-refresh')).toBe(false);
  });
});
