import { FamilyGroup, Subscription, SubscriptionEvent } from '../db/models/associations.ts';
import type { SubscriptionAttributes } from '../db/models/Subscription.model.ts';
import type { SubscriptionPlan, SubscriptionStatus } from '../constants/entitlementFeatures.ts';
import { getOrCreateSubscription } from './entitlements.service.ts';

export class RevenueCatConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RevenueCatConfigError';
  }
}

export class RevenueCatAuthorizationError extends Error {
  constructor(message = 'Invalid RevenueCat webhook authorization') {
    super(message);
    this.name = 'RevenueCatAuthorizationError';
  }
}

interface RevenueCatWebhookEvent {
  id: string;
  type: string;
  app_user_id: string;
  product_id?: string;
  entitlement_ids?: string[];
  period_type?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  store?: string;
}

export interface RevenueCatWebhookPayload {
  api_version?: string;
  event: RevenueCatWebhookEvent;
}

const getEntitlementId = (): string => {
  const entitlementId = process.env.REVENUECAT_ENTITLEMENT_ID;
  if (!entitlementId) {
    throw new RevenueCatConfigError('REVENUECAT_ENTITLEMENT_ID is not configured');
  }
  return entitlementId;
};

export const getAppUserId = (familyGroupId: number): string => `fg_${familyGroupId}`;

const parseFamilyGroupIdFromAppUserId = (appUserId: string): number | null => {
  const match = appUserId.match(/^fg_(\d+)$/);
  if (!match) {
    return null;
  }

  const familyGroupId = Number(match[1]);
  return Number.isNaN(familyGroupId) ? null : familyGroupId;
};

const msToDate = (timestampMs?: number | null): Date | null =>
  timestampMs ? new Date(timestampMs) : null;

const mapStorePlatform = (store?: string): 'ios' | 'android' | null => {
  if (store === 'APP_STORE') {
    return 'ios';
  }
  if (store === 'PLAY_STORE') {
    return 'android';
  }
  return null;
};

const mapBillingInterval = (productId?: string): 'month' | 'year' | null => {
  if (!productId) {
    return null;
  }

  const normalized = productId.toLowerCase();
  if (normalized.includes('year') || normalized.includes('annual')) {
    return 'year';
  }
  if (normalized.includes('month')) {
    return 'month';
  }
  return null;
};

const hasActiveEntitlement = (event: RevenueCatWebhookEvent): boolean => {
  const entitlementId = getEntitlementId();
  return (event.entitlement_ids ?? []).includes(entitlementId);
};

const resolveSubscriptionState = (
  event: RevenueCatWebhookEvent
): {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  paymentFailedAt: Date | null;
} => {
  const expirationAt = msToDate(event.expiration_at_ms);
  const isExpired = !expirationAt || expirationAt.getTime() <= Date.now();
  const entitled = hasActiveEntitlement(event);

  if (event.type === 'BILLING_ISSUE') {
    return {
      plan: 'free',
      status: 'payment_failed',
      cancelAtPeriodEnd: false,
      paymentFailedAt: new Date(),
    };
  }

  if (event.type === 'EXPIRATION' || !entitled || isExpired) {
    return {
      plan: 'free',
      status: 'expired',
      cancelAtPeriodEnd: false,
      paymentFailedAt: null,
    };
  }

  const isTrial = event.period_type === 'TRIAL';
  return {
    plan: 'premium',
    status: isTrial ? 'trialing' : 'active',
    cancelAtPeriodEnd: event.type === 'CANCELLATION',
    paymentFailedAt: null,
  };
};

export const syncSubscriptionFromRevenueCat = async (
  payload: RevenueCatWebhookPayload
): Promise<Subscription | null> => {
  const event = payload.event;
  const familyGroupId = parseFamilyGroupIdFromAppUserId(event.app_user_id);
  if (!familyGroupId) {
    return null;
  }

  const subscription = await getOrCreateSubscription(familyGroupId);
  const expirationAt = msToDate(event.expiration_at_ms);
  const state = resolveSubscriptionState(event);
  const isTrial = event.period_type === 'TRIAL';

  const updates: Partial<SubscriptionAttributes> = {
    plan: state.plan,
    status: state.status,
    billing_interval: mapBillingInterval(event.product_id),
    trial_ends_at: isTrial ? expirationAt : null,
    current_period_end: expirationAt,
    cancel_at_period_end: state.cancelAtPeriodEnd,
    revenuecat_app_user_id: event.app_user_id,
    store_platform: mapStorePlatform(event.store),
    payment_failed_at: state.paymentFailedAt,
  };

  await subscription.update(updates);
  return subscription;
};

export const handleRevenueCatWebhook = async (
  payload: RevenueCatWebhookPayload,
  authorizationHeader?: string
) => {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    throw new RevenueCatConfigError('REVENUECAT_WEBHOOK_SECRET is not configured');
  }

  const token = authorizationHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token || token !== secret) {
    throw new RevenueCatAuthorizationError();
  }

  const eventId = payload.event?.id;
  if (!eventId) {
    throw new Error('Missing RevenueCat event id');
  }

  const existing = await SubscriptionEvent.findOne({
    where: { provider_event_id: eventId },
  });

  if (existing) {
    return { processed: false, subscription: null };
  }

  const subscription = await syncSubscriptionFromRevenueCat(payload);

  await SubscriptionEvent.create({
    subscription_id: subscription?.dataValues.id ?? null,
    provider_event_id: eventId,
    event_type: payload.event.type,
    provider: 'revenuecat',
    payload: payload as unknown as Record<string, unknown>,
  });

  return { processed: true, subscription };
};

export const linkRevenueCatUser = async (
  familyGroupId: number,
  ownerUserId: number
): Promise<string> => {
  const familyGroup = await FamilyGroup.findByPk(familyGroupId);
  if (!familyGroup) {
    throw new Error('Family group not found');
  }

  if (familyGroup.dataValues.created_by !== ownerUserId) {
    throw new Error('Only the family owner can manage billing');
  }

  const appUserId = getAppUserId(familyGroupId);
  const subscription = await getOrCreateSubscription(familyGroupId);
  await subscription.update({ revenuecat_app_user_id: appUserId });
  return appUserId;
};
