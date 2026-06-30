import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { FamilyGroup, Subscription, TrialRedemption, User } from '../../db/models/associations.ts';
import { normalizeEmail } from '../../utils/normalizeEmail.ts';
import * as entitlementsService from '../entitlements.service.ts';
import {
  assertTrialEligible,
  createCheckoutSession,
  isTrialEligible,
  syncSubscriptionFromStripe,
  TrialAlreadyUsedError,
  BillingManagedByStoreError,
} from '../billing.service.ts';

const mockCheckoutSessionsCreate = vi.hoisted(() => vi.fn());

vi.mock('stripe', () => ({
  default: class MockStripe {
    checkout = {
      sessions: {
        create: mockCheckoutSessionsCreate,
      },
    };

    static errors = {
      StripeInvalidRequestError: class StripeInvalidRequestError extends Error {
        code = 'resource_missing';
        param = 'customer';
      },
    };
  },
}));

describe('normalizeEmail', () => {
  it('lowercases, strips plus addressing, and removes Gmail dots', () => {
    expect(normalizeEmail('Jake.Unsted+Trial@Gmail.com')).toBe('jakeunsted@gmail.com');
  });

  it('strips plus addressing for non-Gmail domains without removing dots', () => {
    expect(normalizeEmail('Alex.Smith+trial@example.com')).toBe('alex.smith@example.com');
  });
});

describe('billing.service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCheckoutSessionsCreate.mockReset();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.STRIPE_PRICE_MONTHLY = 'price_monthly';
    process.env.STRIPE_PRICE_YEARLY = 'price_yearly';
    process.env.STRIPE_CHECKOUT_SUCCESS_URL = 'http://localhost:3000/profile?upgraded=1';
    process.env.STRIPE_CHECKOUT_CANCEL_URL = 'http://localhost:3000/plans';
  });

  describe('assertTrialEligible', () => {
    it('returns normalized owner identity when no redemption exists', async () => {
      vi.spyOn(User, 'findByPk').mockResolvedValue({
        dataValues: {
          id: 1,
          email: 'Jake.Unsted+trial@gmail.com',
          normalized_email: null,
          google_id: 'google-1',
        },
        update: vi.fn().mockResolvedValue(undefined),
      } as never);
      vi.spyOn(TrialRedemption, 'findOne').mockResolvedValue(null);

      const result = await assertTrialEligible(1);

      expect(result).toEqual({
        normalizedEmail: 'jakeunsted@gmail.com',
        googleId: 'google-1',
      });
      expect(TrialRedemption.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.any(Object) })
      );
    });

    it('throws when a trial redemption already exists', async () => {
      vi.spyOn(User, 'findByPk').mockResolvedValue({
        dataValues: {
          id: 1,
          email: 'jake@example.com',
          normalized_email: 'jake@example.com',
          google_id: null,
        },
      } as never);
      vi.spyOn(TrialRedemption, 'findOne').mockResolvedValue({ id: 1 } as never);

      await expect(assertTrialEligible(1)).rejects.toThrow(TrialAlreadyUsedError);
    });
  });

  describe('isTrialEligible', () => {
    it('returns true when no redemption exists', async () => {
      vi.spyOn(User, 'findByPk').mockResolvedValue({
        dataValues: {
          id: 1,
          email: 'jake@example.com',
          normalized_email: 'jake@example.com',
          google_id: null,
        },
      } as never);
      vi.spyOn(TrialRedemption, 'findOne').mockResolvedValue(null);

      await expect(isTrialEligible(1)).resolves.toBe(true);
    });

    it('returns false when a trial redemption already exists', async () => {
      vi.spyOn(User, 'findByPk').mockResolvedValue({
        dataValues: {
          id: 1,
          email: 'jake@example.com',
          normalized_email: 'jake@example.com',
          google_id: null,
        },
      } as never);
      vi.spyOn(TrialRedemption, 'findOne').mockResolvedValue({ id: 1 } as never);

      await expect(isTrialEligible(1)).resolves.toBe(false);
    });
  });

  describe('createCheckoutSession', () => {
    const setupCheckoutMocks = (trialRedemptionExists: boolean) => {
      vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue({
        dataValues: { id: 1, name: 'Test Family', created_by: 10 },
      } as never);
      vi.spyOn(User, 'findByPk').mockResolvedValue({
        dataValues: {
          id: 10,
          email: 'owner@example.com',
          normalized_email: 'owner@example.com',
          google_id: null,
        },
        update: vi.fn().mockResolvedValue(undefined),
      } as never);
      vi.spyOn(entitlementsService, 'getOrCreateSubscription').mockResolvedValue({
        dataValues: {
          family_group_id: 1,
          stripe_customer_id: 'cus_123',
        },
      } as never);
      vi.spyOn(TrialRedemption, 'findOne').mockResolvedValue(
        trialRedemptionExists ? ({ id: 1 } as never) : null
      );
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: 'cs_test',
        url: 'https://checkout.stripe.com/test',
      });
    };

    it('includes trial_period_days when owner is trial eligible', async () => {
      setupCheckoutMocks(false);

      await createCheckoutSession(1, 10, 'month');

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_data: expect.objectContaining({
            trial_period_days: 7,
          }),
        })
      );
    });

    it('omits trial_period_days when owner already used their trial', async () => {
      setupCheckoutMocks(true);

      await createCheckoutSession(1, 10, 'month');

      const createArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0];
      expect(createArgs.subscription_data.trial_period_days).toBeUndefined();
    });

    it('throws when billing is managed by a mobile store', async () => {
      vi.spyOn(entitlementsService, 'getOrCreateSubscription').mockResolvedValue({
        dataValues: {
          family_group_id: 1,
          store_platform: 'ios',
        },
      } as never);

      await expect(createCheckoutSession(1, 10, 'month')).rejects.toBeInstanceOf(
        BillingManagedByStoreError
      );
    });
  });

  describe('syncSubscriptionFromStripe', () => {
    const buildStripeSubscription = (
      overrides: Partial<Stripe.Subscription> = {}
    ): Stripe.Subscription => ({
      id: 'sub_123',
      status: 'trialing',
      customer: 'cus_123',
      metadata: { family_group_id: '1' },
      trial_end: 1_700_000_000,
      current_period_end: 1_700_604_800,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            price: {
              recurring: { interval: 'month' },
            },
          },
        ],
      },
      ...overrides,
    } as unknown as Stripe.Subscription);

    it('sets premium trialing state from a Stripe trialing subscription', async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(Subscription, 'findOrCreate').mockResolvedValue([
        {
          dataValues: { id: 1, family_group_id: 1 },
          update,
        },
        false,
      ] as never);

      await syncSubscriptionFromStripe(buildStripeSubscription());

      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        plan: 'premium',
        status: 'trialing',
        billing_interval: 'month',
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_123',
        store_platform: 'web',
      }));
    });

    it('sets payment_failed state for past_due subscriptions', async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(Subscription, 'findOrCreate').mockResolvedValue([
        {
          dataValues: { id: 1, family_group_id: 1 },
          update,
        },
        false,
      ] as never);

      await syncSubscriptionFromStripe(buildStripeSubscription({ status: 'past_due' }));

      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        plan: 'free',
        status: 'payment_failed',
        payment_failed_at: expect.any(Date),
      }));
    });

    it('returns null when no family metadata or existing subscription match exists', async () => {
      vi.spyOn(Subscription, 'findOne').mockResolvedValue(null);
      vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue(null);

      const result = await syncSubscriptionFromStripe(
        buildStripeSubscription({ metadata: {} })
      );

      expect(result).toBeNull();
    });
  });
});
