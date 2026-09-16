import { FamilyGroup, Subscription, SubscriptionEvent } from '../db/models/associations.ts';
import type { SubscriptionAttributes } from '../db/models/Subscription.model.ts';
import type { SubscriptionPlan, SubscriptionStatus } from '@meal-diary/shared';
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
  entitlement_id?: string | null;
  entitlement_ids?: string[] | null;
  entitlements?: Record<string, unknown> | null;
  period_type?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  store?: string;
}

export interface RevenueCatWebhookPayload {
  api_version?: string;
  event: RevenueCatWebhookEvent;
}

const GRANT_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'TEST',
  'REFUND_REVERSED',
  'CANCELLATION',
]);

const IGNORE_EVENT_TYPES = new Set([
  'TRANSFER',
  'SUBSCRIBER_ALIAS',
  'INVOICE_ISSUANCE',
]);

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

const collectEntitlementIds = (event: RevenueCatWebhookEvent): string[] => {
  const ids = new Set<string>();

  for (const id of event.entitlement_ids ?? []) {
    if (id) {
      ids.add(id);
    }
  }

  if (event.entitlement_id) {
    ids.add(event.entitlement_id);
  }

  if (event.entitlements && typeof event.entitlements === 'object') {
    for (const key of Object.keys(event.entitlements)) {
      if (key) {
        ids.add(key);
      }
    }
  }

  return [...ids];
};

const productMatchesEntitlement = (productId: string | undefined, entitlementId: string): boolean => {
  if (!productId) {
    return false;
  }

  const normalized = productId.toLowerCase();
  const configured = entitlementId.toLowerCase();
  return (
    normalized === configured ||
    normalized.startsWith(`${configured}:`) ||
    normalized.startsWith(`${configured}_`)
  );
};

const hasActiveEntitlement = (event: RevenueCatWebhookEvent): boolean => {
  const entitlementId = getEntitlementId();
  const ids = collectEntitlementIds(event);

  if (ids.includes(entitlementId)) {
    return true;
  }

  if (productMatchesEntitlement(event.product_id, entitlementId)) {
    return true;
  }

  // Play/RC can omit entitlement_ids when the product is not mapped yet.
  // Still honor store-active purchase/trial events so access is not revoked.
  return ids.length === 0 && GRANT_EVENT_TYPES.has(event.type);
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
  const isExpired = expirationAt !== null && expirationAt.getTime() <= Date.now();
  const entitled = hasActiveEntitlement(event);

  if (event.type === 'BILLING_ISSUE') {
    return {
      plan: 'free',
      status: 'payment_failed',
      cancelAtPeriodEnd: false,
      paymentFailedAt: new Date(),
    };
  }

  if (
    event.type === 'EXPIRATION' ||
    event.type === 'SUBSCRIPTION_PAUSED' ||
    !entitled ||
    isExpired
  ) {
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

const toWebhookPayload = (stored: Record<string, unknown>): RevenueCatWebhookPayload | null => {
  if (stored.event && typeof stored.event === 'object') {
    return stored as unknown as RevenueCatWebhookPayload;
  }

  if (typeof stored.type === 'string' && typeof stored.app_user_id === 'string') {
    return { event: stored as unknown as RevenueCatWebhookEvent };
  }

  return null;
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
  if (IGNORE_EVENT_TYPES.has(event.type)) {
    return subscription;
  }

  const expirationAt = msToDate(event.expiration_at_ms);
  const state = resolveSubscriptionState(event);
  const isTrial = event.period_type === 'TRIAL';
  const existing = subscription.dataValues as SubscriptionAttributes;

  const updates: Partial<SubscriptionAttributes> = {
    plan: state.plan,
    status: state.status,
    billing_interval: mapBillingInterval(event.product_id) ?? existing.billing_interval,
    trial_ends_at: isTrial
      ? expirationAt
      : state.status === 'expired'
        ? existing.trial_ends_at
        : null,
    current_period_end: expirationAt ?? existing.current_period_end,
    cancel_at_period_end: state.cancelAtPeriodEnd,
    revenuecat_app_user_id: event.app_user_id,
    store_platform: mapStorePlatform(event.store) ?? existing.store_platform,
    payment_failed_at: state.paymentFailedAt,
  };

  await subscription.update(updates);
  return subscription;
};

export const reprocessLatestRevenueCatEvent = async (
  familyGroupId: number
): Promise<Subscription | null> => {
  const subscription = await getOrCreateSubscription(familyGroupId);
  const latest = await SubscriptionEvent.findOne({
    where: {
      subscription_id: subscription.dataValues.id,
      provider: 'revenuecat',
    },
    order: [['id', 'DESC']],
  });

  const stored = latest?.dataValues.payload;
  if (!stored) {
    return subscription;
  }

  const payload = toWebhookPayload(stored);
  if (!payload?.event) {
    return subscription;
  }

  if (!payload.event.app_user_id) {
    payload.event.app_user_id = getAppUserId(familyGroupId);
  }

  return syncSubscriptionFromRevenueCat(payload);
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

  console.info(
    `[RevenueCat] ${payload.event.type} ${payload.event.app_user_id} plan=${subscription?.dataValues.plan ?? 'none'} status=${subscription?.dataValues.status ?? 'none'} entitlements=${JSON.stringify(payload.event.entitlement_ids ?? payload.event.entitlement_id ?? [])}`
  );

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
