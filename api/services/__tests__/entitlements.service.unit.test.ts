import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as billingService from '../billing.service.ts';
import {
  assertCanCreateRecipe,
  EntitlementRequiredError,
  getCurrentIsoWeekMonday,
  isPastWeekEditable,
  isWeekAheadAllowed,
  resolveEntitlements,
} from '../entitlements.service.ts';
import { FamilyGroup, Recipe, Subscription, User } from '../../db/models/associations.ts';

describe('entitlements.service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(billingService, 'isTrialEligible').mockResolvedValue(true);
  });

  describe('getCurrentIsoWeekMonday', () => {
    it('returns Monday for a mid-week date', () => {
      const monday = getCurrentIsoWeekMonday(new Date('2026-06-10T12:00:00Z'));
      expect(monday.getDay()).toBe(1);
    });
  });

  describe('isWeekAheadAllowed', () => {
    it('allows one week ahead on free tier', () => {
      const currentMonday = getCurrentIsoWeekMonday(new Date('2026-06-09T12:00:00Z'));
      const nextMonday = new Date(currentMonday);
      nextMonday.setDate(nextMonday.getDate() + 7);

      expect(isWeekAheadAllowed(nextMonday, 1, new Date('2026-06-09T12:00:00Z'))).toBe(true);
    });

    it('blocks two weeks ahead on free tier', () => {
      const currentMonday = getCurrentIsoWeekMonday(new Date('2026-06-09T12:00:00Z'));
      const twoWeeksAhead = new Date(currentMonday);
      twoWeeksAhead.setDate(twoWeeksAhead.getDate() + 14);

      expect(isWeekAheadAllowed(twoWeeksAhead, 1, new Date('2026-06-09T12:00:00Z'))).toBe(false);
    });
  });

  describe('isPastWeekEditable', () => {
    it('blocks past weeks when not allowed', () => {
      const currentMonday = getCurrentIsoWeekMonday(new Date('2026-06-09T12:00:00Z'));
      const lastMonday = new Date(currentMonday);
      lastMonday.setDate(lastMonday.getDate() - 7);

      expect(isPastWeekEditable(lastMonday, false, new Date('2026-06-09T12:00:00Z'))).toBe(false);
    });

    it('allows past weeks for premium', () => {
      const currentMonday = getCurrentIsoWeekMonday(new Date('2026-06-09T12:00:00Z'));
      const lastMonday = new Date(currentMonday);
      lastMonday.setDate(lastMonday.getDate() - 7);

      expect(isPastWeekEditable(lastMonday, true, new Date('2026-06-09T12:00:00Z'))).toBe(true);
    });
  });

  describe('resolveEntitlements', () => {
    it('returns free limits for a default subscription', async () => {
      vi.spyOn(Subscription, 'findOrCreate').mockResolvedValue([
        {
          dataValues: {
            family_group_id: 1,
            plan: 'free',
            status: 'active',
            is_complimentary: false,
            trial_ends_at: null,
            trial_expired_prompt_seen_at: null,
            payment_failed_at: null,
          },
        },
        false,
      ] as never);

      vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue({
        dataValues: { id: 1, created_by: 10 },
      } as never);

      vi.spyOn(User, 'findByPk').mockResolvedValue({
        dataValues: { id: 10, first_name: 'Alex', username: 'alex' },
      } as never);

      vi.spyOn(User, 'count').mockResolvedValue(2 as never);
      vi.spyOn(Recipe, 'count').mockResolvedValue(5 as never);

      const result = await resolveEntitlements(1, 10);

      expect(result.plan).toBe('free');
      expect(result.limits.maxRecipes).toBe(10);
      expect(result.billing.isOwner).toBe(true);
      expect(result.billing.ownerDisplayName).toBe('Alex');
      expect(result.billing.trialAvailable).toBe(true);
      expect(result.features.edit_past_weeks).toBe(false);
    });

    it('returns premium limits for complimentary families', async () => {
      vi.spyOn(Subscription, 'findOrCreate').mockResolvedValue([
        {
          dataValues: {
            family_group_id: 1,
            plan: 'free',
            status: 'active',
            is_complimentary: true,
            trial_ends_at: null,
            trial_expired_prompt_seen_at: null,
            payment_failed_at: null,
          },
        },
        false,
      ] as never);

      vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue({
        dataValues: { id: 1, created_by: 10 },
      } as never);

      vi.spyOn(User, 'findByPk').mockResolvedValue({
        dataValues: { id: 10, first_name: null, username: 'owner' },
      } as never);

      vi.spyOn(User, 'count').mockResolvedValue(1 as never);
      vi.spyOn(Recipe, 'count').mockResolvedValue(0 as never);

      const result = await resolveEntitlements(1, 99);

      expect(result.plan).toBe('premium');
      expect(result.isComplimentary).toBe(true);
      expect(result.features.edit_past_weeks).toBe(true);
      expect(result.billing.isOwner).toBe(false);
      expect(result.billing.ownerDisplayName).toBe('owner');
    });
  });

  describe('assertCanCreateRecipe', () => {
    it('throws when recipe limit is reached', async () => {
      vi.spyOn(Subscription, 'findOrCreate').mockResolvedValue([
        {
          dataValues: {
            family_group_id: 1,
            plan: 'free',
            status: 'active',
            is_complimentary: false,
            trial_ends_at: null,
            trial_expired_prompt_seen_at: null,
            payment_failed_at: null,
          },
        },
        false,
      ] as never);

      vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue({
        dataValues: { id: 1, created_by: 10 },
      } as never);

      vi.spyOn(User, 'findByPk').mockResolvedValue({
        dataValues: { id: 10, username: 'owner' },
      } as never);

      vi.spyOn(User, 'count').mockResolvedValue(1 as never);
      vi.spyOn(Recipe, 'count').mockResolvedValue(10 as never);

      await expect(assertCanCreateRecipe(1, 10)).rejects.toBeInstanceOf(EntitlementRequiredError);
    });
  });
});
