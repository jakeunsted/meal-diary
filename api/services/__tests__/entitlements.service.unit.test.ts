import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as billingService from '../billing.service.ts';
import {
  assertCanCreateRecipe,
  assertCanNavigateWeek,
  EntitlementRequiredError,
  getCurrentIsoWeekMonday,
  isPastWeekEditable,
  isWeekAheadAllowed,
  resolveEntitlements,
} from '../entitlements.service.ts';
import { FamilyGroup, MealSlot, Recipe, Subscription, User } from '../../db/models/associations.ts';

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
      expect(result.billing.storePlatform).toBeNull();
      expect(result.features.edit_past_weeks).toBe(false);
      expect(result.prompts.customMealNamesLapse).toBe(false);
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

  describe('assertCanNavigateWeek', () => {
    it('throws when viewing beyond the free planning horizon', async () => {
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
      vi.spyOn(Recipe, 'count').mockResolvedValue(1 as never);

      const currentMonday = getCurrentIsoWeekMonday();
      const twoWeeksAhead = new Date(currentMonday);
      twoWeeksAhead.setDate(twoWeeksAhead.getDate() + 14);

      await expect(
        assertCanNavigateWeek(1, 10, twoWeeksAhead)
      ).rejects.toBeInstanceOf(EntitlementRequiredError);
    });

    it('allows viewing past weeks on free tier', async () => {
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
      vi.spyOn(Recipe, 'count').mockResolvedValue(1 as never);

      const currentMonday = getCurrentIsoWeekMonday();
      const lastMonday = new Date(currentMonday);
      lastMonday.setDate(lastMonday.getDate() - 7);

      await expect(assertCanNavigateWeek(1, 10, lastMonday)).resolves.toMatchObject({
        plan: 'free',
      });
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

  describe('prompts.customMealNamesLapse', () => {
    const entitlementSlot = (id: number, name: string, position: number) => ({
      dataValues: {
        id,
        name,
        position,
        legacy_key: null,
        archived_at: null,
      },
    });

    const customMealSlots = [
      entitlementSlot(1, 'Brekkie', 1),
      entitlementSlot(2, 'Lunch', 2),
      entitlementSlot(3, 'Dinner', 3),
      entitlementSlot(4, 'Snack', 4),
    ];

    const expiredSubscription = (overrides: Record<string, unknown> = {}) => ({
      family_group_id: 1,
      plan: 'free',
      status: 'expired',
      is_complimentary: false,
      trial_ends_at: null,
      trial_expired_prompt_seen_at: null,
      payment_failed_at: null,
      cancel_at_period_end: false,
      meal_names_reset_effective_on: null,
      meal_names_reset_applied_at: null,
      store_platform: null,
      ...overrides,
    });

    const mockEntitlementFamily = (
      subscription: Record<string, unknown>,
      slots = customMealSlots
    ) => {
      vi.spyOn(Subscription, 'findOrCreate').mockResolvedValue([
        { dataValues: subscription, reload: vi.fn() },
        false,
      ] as never);
      vi.spyOn(Subscription, 'findOne').mockResolvedValue({
        dataValues: {
          meal_names_reset_effective_on: null,
          meal_names_reset_applied_at: null,
        },
      } as never);
      vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue({
        dataValues: { id: 1, created_by: 10 },
      } as never);
      vi.spyOn(User, 'findByPk').mockResolvedValue({
        dataValues: { id: 10, first_name: 'Alex', username: 'alex' },
      } as never);
      vi.spyOn(User, 'count').mockResolvedValue(2 as never);
      vi.spyOn(Recipe, 'count').mockResolvedValue(1 as never);
      vi.spyOn(MealSlot, 'findAll').mockResolvedValue(slots as never);
    };

    it('is true for the owner and a non-owner when Family Plus has ended and names differ', async () => {
      mockEntitlementFamily(expiredSubscription());

      const owner = await resolveEntitlements(1, 10);
      const member = await resolveEntitlements(1, 99);

      expect(owner.prompts.customMealNamesLapse).toBe(true);
      expect(owner.billing.isOwner).toBe(true);
      expect(member.prompts.customMealNamesLapse).toBe(true);
      expect(member.billing.isOwner).toBe(false);
    });

    it('is true when the three names are in a different order', async () => {
      mockEntitlementFamily(expiredSubscription(), [
        entitlementSlot(1, 'Lunch', 1),
        entitlementSlot(2, 'Breakfast', 2),
        entitlementSlot(3, 'Dinner', 3),
      ]);

      const result = await resolveEntitlements(1, 10);

      expect(result.prompts.customMealNamesLapse).toBe(true);
    });

    it('stays false for active, cancelled trialing, payment_failed, and complimentary', async () => {
      const cases = [
        expiredSubscription({ plan: 'premium', status: 'active', cancel_at_period_end: true }),
        expiredSubscription({
          plan: 'premium',
          status: 'trialing',
          cancel_at_period_end: true,
        }),
        expiredSubscription({ plan: 'free', status: 'payment_failed' }),
        expiredSubscription({ is_complimentary: true, status: 'expired', plan: 'free' }),
      ];

      for (const subscription of cases) {
        vi.restoreAllMocks();
        vi.spyOn(billingService, 'isTrialEligible').mockResolvedValue(true);
        mockEntitlementFamily(subscription);
        const result = await resolveEntitlements(1, 10);
        expect(result.prompts.customMealNamesLapse).toBe(false);
      }
    });

    it('stays false for the three default names and for a pending reset', async () => {
      mockEntitlementFamily(expiredSubscription(), [
        entitlementSlot(1, ' Breakfast ', 1),
        entitlementSlot(2, 'Lunch', 2),
        entitlementSlot(3, 'Dinner', 3),
      ]);
      const defaults = await resolveEntitlements(1, 10);
      expect(defaults.prompts.customMealNamesLapse).toBe(false);

      vi.restoreAllMocks();
      vi.spyOn(billingService, 'isTrialEligible').mockResolvedValue(true);
      mockEntitlementFamily(
        expiredSubscription({ meal_names_reset_effective_on: '2099-01-01' })
      );
      const pending = await resolveEntitlements(1, 99);
      expect(pending.prompts.customMealNamesLapse).toBe(false);
      expect(pending.billing.isOwner).toBe(false);
      expect(MealSlot.findAll).not.toHaveBeenCalled();
    });
  });
});
