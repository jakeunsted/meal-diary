import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subscription, SubscriptionEvent } from '../../db/models/associations.ts';
import * as entitlementsService from '../entitlements.service.ts';
import {
  getAppUserId,
  handleRevenueCatWebhook,
  reprocessLatestRevenueCatEvent,
  syncSubscriptionFromRevenueCat,
} from '../revenuecat.service.ts';

describe('revenuecat.service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.REVENUECAT_ENTITLEMENT_ID = 'family_plus';
    process.env.REVENUECAT_WEBHOOK_SECRET = 'rc_webhook_secret';
  });

  describe('getAppUserId', () => {
    it('returns a stable family-group scoped app user id', () => {
      expect(getAppUserId(42)).toBe('fg_42');
    });
  });

  describe('syncSubscriptionFromRevenueCat', () => {
    it('maps an active entitlement to premium ios billing', async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(entitlementsService, 'getOrCreateSubscription').mockResolvedValue({
        dataValues: { id: 1, family_group_id: 5 },
        update,
      } as never);

      await syncSubscriptionFromRevenueCat({
        event: {
          id: 'evt_1',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'fg_5',
          entitlement_ids: ['family_plus'],
          product_id: 'family_plus_monthly',
          period_type: 'NORMAL',
          expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
          store: 'APP_STORE',
        },
      });

      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        plan: 'premium',
        status: 'active',
        billing_interval: 'month',
        store_platform: 'ios',
        revenuecat_app_user_id: 'fg_5',
      }));
    });

    it('maps a Play trial purchase without entitlement_ids to premium trialing', async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(entitlementsService, 'getOrCreateSubscription').mockResolvedValue({
        dataValues: {
          id: 1,
          family_group_id: 6,
          billing_interval: null,
          trial_ends_at: null,
          current_period_end: null,
          store_platform: null,
        },
        update,
      } as never);

      const trialEndsAt = Date.now() + 3 * 60 * 1000;

      await syncSubscriptionFromRevenueCat({
        event: {
          id: 'evt_play_trial',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'fg_6',
          entitlement_ids: null,
          product_id: 'family_plus:monthly',
          period_type: 'TRIAL',
          expiration_at_ms: trialEndsAt,
          store: 'PLAY_STORE',
        },
      });

      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        plan: 'premium',
        status: 'trialing',
        billing_interval: 'month',
        store_platform: 'android',
        revenuecat_app_user_id: 'fg_6',
      }));
    });

    it('maps a Play purchase whose product id matches the entitlement', async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(entitlementsService, 'getOrCreateSubscription').mockResolvedValue({
        dataValues: {
          id: 1,
          family_group_id: 5,
          billing_interval: 'month',
          trial_ends_at: null,
          current_period_end: null,
          store_platform: 'android',
        },
        update,
      } as never);

      await syncSubscriptionFromRevenueCat({
        event: {
          id: 'evt_product_match',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'fg_5',
          entitlement_ids: [],
          product_id: 'family_plus:yearly',
          period_type: 'NORMAL',
          expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
          store: 'PLAY_STORE',
        },
      });

      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        plan: 'premium',
        status: 'active',
        billing_interval: 'year',
      }));
    });

    it('does not expire the subscription on transfer events', async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(entitlementsService, 'getOrCreateSubscription').mockResolvedValue({
        dataValues: {
          id: 1,
          family_group_id: 5,
          plan: 'premium',
          status: 'trialing',
        },
        update,
      } as never);

      await syncSubscriptionFromRevenueCat({
        event: {
          id: 'evt_transfer',
          type: 'TRANSFER',
          app_user_id: 'fg_5',
          entitlement_ids: [],
          store: 'PLAY_STORE',
        },
      });

      expect(update).not.toHaveBeenCalled();
    });

    it('reprocesses the latest stored webhook with the current mapping', async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      const subscription = {
        dataValues: {
          id: 9,
          family_group_id: 6,
          billing_interval: 'month',
          trial_ends_at: new Date(),
          current_period_end: new Date(),
          store_platform: 'android',
        },
        update,
      };
      vi.spyOn(entitlementsService, 'getOrCreateSubscription').mockResolvedValue(subscription as never);
      vi.spyOn(SubscriptionEvent, 'findOne').mockResolvedValue({
        dataValues: {
          payload: {
            event: {
              id: 'evt_stored',
              type: 'INITIAL_PURCHASE',
              app_user_id: 'fg_6',
              product_id: 'family_plus:monthly',
              period_type: 'TRIAL',
              expiration_at_ms: Date.now() + 60_000,
              store: 'PLAY_STORE',
            },
          },
        },
      } as never);

      await reprocessLatestRevenueCatEvent(6);

      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        plan: 'premium',
        status: 'trialing',
      }));
    });

    it('maps expiration events to free expired state', async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(entitlementsService, 'getOrCreateSubscription').mockResolvedValue({
        dataValues: { id: 1, family_group_id: 5 },
        update,
      } as never);

      await syncSubscriptionFromRevenueCat({
        event: {
          id: 'evt_2',
          type: 'EXPIRATION',
          app_user_id: 'fg_5',
          entitlement_ids: ['family_plus'],
          expiration_at_ms: Date.now() - 1000,
          store: 'PLAY_STORE',
        },
      });

      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        plan: 'free',
        status: 'expired',
        store_platform: 'android',
      }));
    });
  });

  describe('handleRevenueCatWebhook', () => {
    it('is idempotent for duplicate provider event ids', async () => {
      vi.spyOn(SubscriptionEvent, 'findOne').mockResolvedValue({ id: 1 } as never);
      const syncSpy = vi.spyOn(entitlementsService, 'getOrCreateSubscription');

      const result = await handleRevenueCatWebhook(
        {
          event: {
            id: 'evt_duplicate',
            type: 'RENEWAL',
            app_user_id: 'fg_1',
            entitlement_ids: ['family_plus'],
            expiration_at_ms: Date.now() + 1000,
          },
        },
        'Bearer rc_webhook_secret'
      );

      expect(result.processed).toBe(false);
      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('records a subscription event for new webhook payloads', async () => {
      vi.spyOn(SubscriptionEvent, 'findOne').mockResolvedValue(null);
      vi.spyOn(SubscriptionEvent, 'create').mockResolvedValue({ id: 99 } as never);
      vi.spyOn(entitlementsService, 'getOrCreateSubscription').mockResolvedValue({
        dataValues: { id: 7, family_group_id: 1 },
        update: vi.fn().mockResolvedValue(undefined),
      } as never);

      const result = await handleRevenueCatWebhook(
        {
          event: {
            id: 'evt_new',
            type: 'RENEWAL',
            app_user_id: 'fg_1',
            entitlement_ids: ['family_plus'],
            expiration_at_ms: Date.now() + 1000,
            store: 'APP_STORE',
          },
        },
        'Bearer rc_webhook_secret'
      );

      expect(result.processed).toBe(true);
      expect(SubscriptionEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'revenuecat',
          provider_event_id: 'evt_new',
        })
      );
    });
  });
});
