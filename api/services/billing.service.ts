import Stripe from 'stripe';
import { Op } from 'sequelize';
import {
  FamilyGroup,
  Subscription,
  SubscriptionEvent,
  TrialRedemption,
  User,
} from '../db/models/associations.ts';
import type { SubscriptionAttributes } from '../db/models/Subscription.model.ts';
import type { UserAttributes } from '../db/models/User.model.ts';
import { TRIAL_DAYS } from '../constants/subscriptionPlans.ts';
import { normalizeEmail } from '../utils/normalizeEmail.ts';
import { getOrCreateSubscription } from './entitlements.service.ts';

type BillingInterval = 'month' | 'year';

interface CheckoutSessionResult {
  id: string;
  url: string | null;
}

interface PortalSessionResult {
  id: string;
  url: string;
}

export class BillingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingConfigError';
  }
}

export class BillingAuthorizationError extends Error {
  constructor(message = 'Only the family owner can manage billing') {
    super(message);
    this.name = 'BillingAuthorizationError';
  }
}

export class TrialAlreadyUsedError extends Error {
  readonly code = 'TRIAL_ALREADY_USED';

  constructor() {
    super('TRIAL_ALREADY_USED');
    this.name = 'TrialAlreadyUsedError';
  }
}

const getStripe = (): Stripe => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new BillingConfigError('STRIPE_SECRET_KEY is not configured');
  }

  return new Stripe(secretKey);
};

const getPriceId = (interval: BillingInterval): string => {
  const priceId =
    interval === 'year'
      ? process.env.STRIPE_PRICE_YEARLY
      : process.env.STRIPE_PRICE_MONTHLY;

  if (!priceId) {
    throw new BillingConfigError(`Stripe ${interval} price is not configured`);
  }

  return priceId;
};

const getRequiredUrl = (key: 'STRIPE_CHECKOUT_SUCCESS_URL' | 'STRIPE_CHECKOUT_CANCEL_URL') => {
  const value = process.env[key];
  if (!value) {
    throw new BillingConfigError(`${key} is not configured`);
  }
  return value;
};

const getAllowedCheckoutOrigins = (): Set<string> => {
  const origins = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  for (const key of [
    'STRIPE_CHECKOUT_SUCCESS_URL',
    'STRIPE_CHECKOUT_CANCEL_URL',
    'ORIGIN',
    'DEV_WEBHOOK_BASE_URL',
  ] as const) {
    const value = process.env[key];
    if (!value) {
      continue;
    }

    try {
      origins.add(new URL(value).origin);
    } catch {
      // ignore invalid env URLs
    }
  }

  const extraOrigins = process.env.STRIPE_CHECKOUT_ALLOWED_ORIGINS;
  if (extraOrigins) {
    for (const origin of extraOrigins.split(',')) {
      const trimmed = origin.trim();
      if (!trimmed) {
        continue;
      }

      try {
        origins.add(new URL(trimmed).origin);
      } catch {
        try {
          origins.add(new URL(`https://${trimmed}`).origin);
        } catch {
          // ignore invalid entries
        }
      }
    }
  }

  return origins;
};

const isDevCheckoutOriginAllowed = (origin: string): boolean => {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }

    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.local');

    const isMealDiaryDomain =
      hostname === 'mealdiary.co.uk' ||
      hostname.endsWith('.mealdiary.co.uk');

    return isLocalhost || isMealDiaryDomain;
  } catch {
    return false;
  }
};

const resolveCheckoutRedirectUrl = (
  overrideUrl: string | undefined,
  fallbackEnvKey: 'STRIPE_CHECKOUT_SUCCESS_URL' | 'STRIPE_CHECKOUT_CANCEL_URL'
): string => {
  const fallback = getRequiredUrl(fallbackEnvKey);
  if (!overrideUrl) {
    return fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(overrideUrl);
  } catch {
    throw new BillingConfigError('Invalid checkout redirect URL');
  }

  if (!getAllowedCheckoutOrigins().has(parsed.origin) && !isDevCheckoutOriginAllowed(parsed.origin)) {
    throw new BillingConfigError(`Checkout redirect origin is not allowed: ${parsed.origin}`);
  }

  return overrideUrl;
};

const isMissingStripeCustomerError = (error: unknown): boolean => {
  if (!(error instanceof Stripe.errors.StripeInvalidRequestError)) {
    return false;
  }

  return error.code === 'resource_missing' && error.param === 'customer';
};

const assertFamilyOwner = async (
  familyGroupId: number,
  userId: number
) => {
  const familyGroup = await FamilyGroup.findByPk(familyGroupId);
  if (!familyGroup) {
    throw new Error('Family group not found');
  }

  if (familyGroup.dataValues.created_by !== userId) {
    throw new BillingAuthorizationError();
  }

  return familyGroup;
};

const getOwner = async (ownerUserId: number): Promise<User & UserAttributes> => {
  const owner = await User.findByPk(ownerUserId) as User & UserAttributes | null;
  if (!owner) {
    throw new Error('User not found');
  }
  return owner;
};

const normalizeOwnerEmail = async (owner: User & UserAttributes) => {
  const normalizedEmail = owner.dataValues.normalized_email ?? normalizeEmail(owner.dataValues.email);

  if (!owner.dataValues.normalized_email) {
    await owner.update({ normalized_email: normalizedEmail });
  }

  return normalizedEmail;
};

export const assertTrialEligible = async (
  ownerUserId: number,
  stripeCustomerId?: string | null
) => {
  const owner = await getOwner(ownerUserId);
  const normalizedEmail = await normalizeOwnerEmail(owner);
  const conditions = [
    { normalized_email: normalizedEmail },
    ...(owner.dataValues.google_id ? [{ google_id: owner.dataValues.google_id }] : []),
    ...(stripeCustomerId ? [{ stripe_customer_id: stripeCustomerId }] : []),
  ];

  const existing = await TrialRedemption.findOne({
    where: { [Op.or]: conditions },
  });

  if (existing) {
    throw new TrialAlreadyUsedError();
  }

  return {
    normalizedEmail,
    googleId: owner.dataValues.google_id ?? null,
  };
};

const recordTrialRedemption = async (
  ownerUserId: number,
  familyGroupId: number,
  stripeCustomerId: string | null
) => {
  const owner = await getOwner(ownerUserId);
  const normalizedEmail = await normalizeOwnerEmail(owner);

  await TrialRedemption.findOrCreate({
    where: { normalized_email: normalizedEmail },
    defaults: {
      normalized_email: normalizedEmail,
      google_id: owner.dataValues.google_id ?? null,
      stripe_customer_id: stripeCustomerId,
      family_group_id: familyGroupId,
    },
  });
};

interface CheckoutRedirectUrls {
  successUrl?: string;
  cancelUrl?: string;
}

export const createCheckoutSession = async (
  familyGroupId: number,
  ownerUserId: number,
  interval: BillingInterval,
  redirectUrls?: CheckoutRedirectUrls
): Promise<CheckoutSessionResult> => {
  const familyGroup = await assertFamilyOwner(familyGroupId, ownerUserId);
  const owner = await getOwner(ownerUserId);
  const subscription = await getOrCreateSubscription(familyGroupId);
  const subscriptionData = subscription.dataValues as SubscriptionAttributes;
  const priceId = getPriceId(interval);
  const stripe = getStripe();

  await assertTrialEligible(ownerUserId, subscriptionData.stripe_customer_id);

  const successUrl = resolveCheckoutRedirectUrl(
    redirectUrls?.successUrl,
    'STRIPE_CHECKOUT_SUCCESS_URL'
  );
  const cancelUrl = resolveCheckoutRedirectUrl(
    redirectUrls?.cancelUrl,
    'STRIPE_CHECKOUT_CANCEL_URL'
  );

  const createSession = (stripeCustomerId: string | null) => stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId ?? undefined,
    customer_email: stripeCustomerId ? undefined : owner.dataValues.email,
    client_reference_id: String(familyGroupId),
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: {
        family_group_id: String(familyGroupId),
        owner_user_id: String(ownerUserId),
        interval,
      },
    },
    metadata: {
      family_group_id: String(familyGroupId),
      owner_user_id: String(ownerUserId),
      interval,
      family_group_name: familyGroup.dataValues.name,
    },
  });

  let session: Stripe.Checkout.Session;

  try {
    session = await createSession(subscriptionData.stripe_customer_id);
  } catch (error) {
    if (!isMissingStripeCustomerError(error) || !subscriptionData.stripe_customer_id) {
      throw error;
    }

    // Local/dev Stripe customers can be deleted during testing. Clear stale
    // provider IDs and retry so Checkout can create a fresh customer.
    await subscription.update({
      stripe_customer_id: null,
      stripe_subscription_id: null,
    });

    session = await createSession(null);
  }

  return {
    id: session.id,
    url: session.url,
  };
};

export const createPortalSession = async (
  familyGroupId: number,
  ownerUserId: number,
  returnUrl?: string
): Promise<PortalSessionResult> => {
  await assertFamilyOwner(familyGroupId, ownerUserId);
  const subscription = await getOrCreateSubscription(familyGroupId);
  const stripeCustomerId = subscription.dataValues.stripe_customer_id;

  if (!stripeCustomerId) {
    throw new Error('No Stripe customer found for this family');
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: resolveCheckoutRedirectUrl(returnUrl, 'STRIPE_CHECKOUT_SUCCESS_URL'),
  });

  return {
    id: session.id,
    url: session.url,
  };
};

const toDate = (timestamp?: number | null): Date | null =>
  timestamp ? new Date(timestamp * 1000) : null;

const getInterval = (stripeSubscription: Stripe.Subscription): BillingInterval | null => {
  const interval = stripeSubscription.items.data[0]?.price.recurring?.interval;
  return interval === 'month' || interval === 'year' ? interval : null;
};

const getFamilyGroupIdFromStripeSubscription = async (
  stripeSubscription: Stripe.Subscription
): Promise<number | null> => {
  const metadataFamilyId = Number(stripeSubscription.metadata?.family_group_id);
  if (metadataFamilyId && !Number.isNaN(metadataFamilyId)) {
    return metadataFamilyId;
  }

  const subscription = await Subscription.findOne({
    where: { stripe_subscription_id: stripeSubscription.id },
  });

  return subscription?.dataValues.family_group_id ?? null;
};

export const syncSubscriptionFromStripe = async (
  stripeSubscription: Stripe.Subscription
): Promise<Subscription | null> => {
  const familyGroupId = await getFamilyGroupIdFromStripeSubscription(stripeSubscription);
  if (!familyGroupId) {
    return null;
  }

  const subscription = await getOrCreateSubscription(familyGroupId);
  const status = stripeSubscription.status;
  const isPremium = status === 'active' || status === 'trialing';
  const isPaymentFailed = status === 'past_due' || status === 'unpaid';

  await subscription.update({
    plan: isPremium ? 'premium' : 'free',
    status: status === 'trialing'
      ? 'trialing'
      : status === 'active'
        ? 'active'
        : isPaymentFailed
          ? 'payment_failed'
          : 'expired',
    billing_interval: getInterval(stripeSubscription),
    trial_ends_at: toDate(stripeSubscription.trial_end),
    current_period_end: toDate(stripeSubscription.current_period_end),
    cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    stripe_customer_id: typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer.id,
    stripe_subscription_id: stripeSubscription.id,
    store_platform: 'web',
    payment_failed_at: isPaymentFailed ? new Date() : null,
  });

  return subscription;
};

const retrieveStripeSubscription = async (subscriptionId: string) => {
  const stripe = getStripe();
  return stripe.subscriptions.retrieve(subscriptionId);
};

const handleCheckoutCompleted = async (session: Stripe.Checkout.Session) => {
  if (typeof session.subscription !== 'string') {
    return null;
  }

  const stripeSubscription = await retrieveStripeSubscription(session.subscription);
  const subscription = await syncSubscriptionFromStripe(stripeSubscription);
  const familyGroupId = Number(session.metadata?.family_group_id ?? session.client_reference_id);
  const ownerUserId = Number(session.metadata?.owner_user_id);

  if (
    stripeSubscription.status === 'trialing' &&
    familyGroupId &&
    ownerUserId &&
    !Number.isNaN(familyGroupId) &&
    !Number.isNaN(ownerUserId)
  ) {
    await recordTrialRedemption(
      ownerUserId,
      familyGroupId,
      typeof session.customer === 'string' ? session.customer : null
    );
  }

  return subscription;
};

export const confirmCheckoutSession = async (
  sessionId: string,
  familyGroupId: number,
  ownerUserId: number
): Promise<Subscription | null> => {
  await assertFamilyOwner(familyGroupId, ownerUserId);

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.status !== 'complete') {
    throw new Error('Checkout session is not complete');
  }

  const sessionFamilyId = Number(session.metadata?.family_group_id ?? session.client_reference_id);
  if (!sessionFamilyId || sessionFamilyId !== familyGroupId) {
    throw new BillingAuthorizationError('Checkout session does not match family group');
  }

  const sessionOwnerId = Number(session.metadata?.owner_user_id);
  if (sessionOwnerId && !Number.isNaN(sessionOwnerId) && sessionOwnerId !== ownerUserId) {
    throw new BillingAuthorizationError('Checkout session does not match user');
  }

  return handleCheckoutCompleted(session);
};

const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
  const stripeSubscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;

  if (!stripeSubscriptionId) {
    return null;
  }

  const subscription = await Subscription.findOne({
    where: { stripe_subscription_id: stripeSubscriptionId },
  });

  if (!subscription) {
    return null;
  }

  await subscription.update({
    plan: 'free',
    status: 'payment_failed',
    payment_failed_at: new Date(),
    current_period_end: toDate(invoice.period_end),
  });

  return subscription;
};

export const constructStripeEvent = (
  rawBody: Buffer,
  signature: string | string[] | undefined
) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new BillingConfigError('STRIPE_WEBHOOK_SECRET is not configured');
  }

  if (!signature || Array.isArray(signature)) {
    throw new Error('Missing Stripe signature');
  }

  return getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
};

export const handleStripeWebhook = async (event: Stripe.Event) => {
  const existing = await SubscriptionEvent.findOne({
    where: { stripe_event_id: event.id },
  });

  if (existing) {
    return { processed: false, subscription: null };
  }

  let subscription: Subscription | null = null;

  switch (event.type) {
    case 'checkout.session.completed':
      subscription = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case 'customer.subscription.updated':
      subscription = await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      subscription = await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_failed':
      subscription = await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    default:
      break;
  }

  await SubscriptionEvent.create({
    subscription_id: subscription?.dataValues.id ?? null,
    stripe_event_id: event.id,
    event_type: event.type,
    provider: 'stripe',
    payload: event as unknown as Record<string, unknown>,
  });

  return { processed: true, subscription };
};
