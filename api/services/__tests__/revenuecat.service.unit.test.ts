import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subscription, SubscriptionEvent } from '../../db/models/associations.ts';
import * as entitlementsService from '../entitlements.service.ts';
import {
  getAppUserId,
  handleRevenueCatWebhook,
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
