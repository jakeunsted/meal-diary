import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/billing.service.ts', () => {
  class BillingAuthorizationError extends Error {
    constructor(message = 'Only the family owner can manage billing') {
      super(message);
      this.name = 'BillingAuthorizationError';
    }
  }
  class BillingConfigError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'BillingConfigError';
    }
  }
  class TrialAlreadyUsedError extends Error {
    readonly code = 'TRIAL_ALREADY_USED';
    constructor() {
      super('TRIAL_ALREADY_USED');
      this.name = 'TrialAlreadyUsedError';
    }
  }
  class BillingManagedByStoreError extends Error {
    readonly code = 'BILLING_MANAGED_BY_STORE';
    constructor() {
      super('BILLING_MANAGED_BY_STORE');
      this.name = 'BillingManagedByStoreError';
    }
  }
  class AlreadySubscribedError extends Error {
    readonly code = 'ALREADY_SUBSCRIBED';
    constructor() {
      super('ALREADY_SUBSCRIBED');
      this.name = 'AlreadySubscribedError';
    }
  }

  return {
    BillingAuthorizationError,
    BillingConfigError,
    TrialAlreadyUsedError,
    BillingManagedByStoreError,
    AlreadySubscribedError,
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    confirmCheckoutSession: vi.fn(),
    constructStripeEvent: vi.fn(),
    handleStripeWebhook: vi.fn(),
  };
});

vi.mock('../../services/revenuecat.service.ts', () => {
  class RevenueCatAuthorizationError extends Error {
    constructor(message = 'Invalid RevenueCat webhook authorization') {
      super(message);
      this.name = 'RevenueCatAuthorizationError';
    }
  }
  class RevenueCatConfigError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RevenueCatConfigError';
    }
  }

  return {
    RevenueCatAuthorizationError,
    RevenueCatConfigError,
    linkRevenueCatUser: vi.fn(),
    reprocessLatestRevenueCatEvent: vi.fn(),
    handleRevenueCatWebhook: vi.fn(),
  };
});

vi.mock('../../services/entitlements.service.ts', () => ({
  resolveEntitlements: vi.fn(),
}));

vi.mock('../../utils/otelLogs.ts', () => ({
  emitLog: vi.fn(),
}));

import {
  AlreadySubscribedError,
  BillingAuthorizationError,
  BillingConfigError,
  BillingManagedByStoreError,
  TrialAlreadyUsedError,
  confirmCheckoutSession,
  constructStripeEvent,
  createCheckoutSession,
  createPortalSession,
  handleStripeWebhook,
} from '../../services/billing.service.ts';
import { resolveEntitlements } from '../../services/entitlements.service.ts';
import {
  RevenueCatAuthorizationError,
  RevenueCatConfigError,
  handleRevenueCatWebhook,
  linkRevenueCatUser,
  reprocessLatestRevenueCatEvent,
} from '../../services/revenuecat.service.ts';
import { emitLog } from '../../utils/otelLogs.ts';
import {
  confirmCheckout,
  createCheckout,
  createPortal,
  linkRevenueCat,
  revenueCatWebhook,
  stripeWebhook,
  syncRevenueCat,
} from '../billing/billing.controller.ts';

const mockResponse = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }) as unknown as Response;

const mockRequest = (body: Record<string, unknown> = {}, userId?: number) =>
  ({
    body,
    headers: { authorization: 'Bearer secret', 'stripe-signature': 'sig' },
    user: userId === undefined ? undefined : { dataValues: { id: userId } },
  }) as unknown as Request;

describe('billing.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a checkout session and rejects a missing user or interval', async () => {
    vi.mocked(createCheckoutSession).mockResolvedValue({ id: 'cs_1', url: 'https://pay' } as never);
    const res = mockResponse();

    await createCheckout(mockRequest({ family_group_id: 4, interval: 'month' }, 5), res);

    expect(createCheckoutSession).toHaveBeenCalledWith(4, 5, 'month', {
      successUrl: undefined,
      cancelUrl: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);

    const unauthorized = mockResponse();
    await createCheckout(mockRequest({ family_group_id: 4, interval: 'month' }), unauthorized);
    expect(unauthorized.status).toHaveBeenCalledWith(401);

    const invalid = mockResponse();
    await createCheckout(mockRequest({ family_group_id: 0, interval: 'week' }, 5), invalid);
    expect(invalid.status).toHaveBeenCalledWith(400);
  });

  it('maps billing errors from checkout', async () => {
    vi.mocked(createCheckoutSession).mockRejectedValueOnce(new BillingAuthorizationError());
    const forbidden = mockResponse();
    await createCheckout(mockRequest({ family_group_id: 4, interval: 'year' }, 5), forbidden);
    expect(forbidden.status).toHaveBeenCalledWith(403);

    vi.mocked(createCheckoutSession).mockRejectedValueOnce(new TrialAlreadyUsedError());
    const trial = mockResponse();
    await createCheckout(mockRequest({ family_group_id: 4, interval: 'year' }, 5), trial);
    expect(trial.status).toHaveBeenCalledWith(409);
    expect(trial.json).toHaveBeenCalledWith({
      code: 'TRIAL_ALREADY_USED',
      message: 'You have already used your free trial',
    });

    vi.mocked(createCheckoutSession).mockRejectedValueOnce(new BillingManagedByStoreError());
    const store = mockResponse();
    await createCheckout(mockRequest({ family_group_id: 4, interval: 'year' }, 5), store);
    expect(store.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BILLING_MANAGED_BY_STORE' }));

    vi.mocked(createCheckoutSession).mockRejectedValueOnce(new AlreadySubscribedError());
    const subscribed = mockResponse();
    await createCheckout(mockRequest({ family_group_id: 4, interval: 'year' }, 5), subscribed);
    expect(subscribed.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ALREADY_SUBSCRIBED' }));

    vi.mocked(createCheckoutSession).mockRejectedValueOnce(new BillingConfigError('redirect URL is not allowed'));
    const redirect = mockResponse();
    await createCheckout(mockRequest({ family_group_id: 4, interval: 'year' }, 5), redirect);
    expect(redirect.status).toHaveBeenCalledWith(400);
    expect(redirect.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CHECKOUT_REDIRECT_NOT_ALLOWED' }));

    vi.mocked(createCheckoutSession).mockRejectedValueOnce(new Error('Family group not found'));
    const missing = mockResponse();
    await createCheckout(mockRequest({ family_group_id: 4, interval: 'year' }, 5), missing);
    expect(missing.status).toHaveBeenCalledWith(404);
  });

  it('creates a portal session and confirms a checkout', async () => {
    vi.mocked(createPortalSession).mockResolvedValue({ url: 'https://portal' } as never);
    const portal = mockResponse();
    await createPortal(mockRequest({ family_group_id: 4 }, 5), portal);
    expect(portal.status).toHaveBeenCalledWith(200);

    const missing = mockResponse();
    await createPortal(mockRequest({}, 5), missing);
    expect(missing.status).toHaveBeenCalledWith(400);

    vi.mocked(confirmCheckoutSession).mockResolvedValue({ id: 1 } as never);
    const confirmed = mockResponse();
    await confirmCheckout(mockRequest({ family_group_id: 4, session_id: 'cs_1' }, 5), confirmed);
    expect(confirmed.json).toHaveBeenCalledWith({ synced: true });

    vi.mocked(confirmCheckoutSession).mockResolvedValue(null as never);
    const empty = mockResponse();
    await confirmCheckout(mockRequest({ family_group_id: 4, session_id: 'cs_1' }, 5), empty);
    expect(empty.json).toHaveBeenCalledWith({ synced: false });
  });

  it('accepts Stripe and RevenueCat webhooks and reports invalid payloads', async () => {
    vi.mocked(constructStripeEvent).mockReturnValue({ id: 'evt_1' } as never);
    vi.mocked(handleStripeWebhook).mockResolvedValue(undefined as never);
    const stripe = mockResponse();
    await stripeWebhook(mockRequest(Buffer.from('{}') as unknown as Record<string, unknown>), stripe);
    expect(stripe.json).toHaveBeenCalledWith({ received: true });

    vi.mocked(constructStripeEvent).mockImplementationOnce(() => {
      throw new Error('bad signature');
    });
    const invalidStripe = mockResponse();
    await stripeWebhook(mockRequest(), invalidStripe);
    expect(emitLog).toHaveBeenCalled();
    expect(invalidStripe.status).toHaveBeenCalledWith(400);

    vi.mocked(handleRevenueCatWebhook).mockResolvedValue(undefined as never);
    const revenueCat = mockResponse();
    await revenueCatWebhook(mockRequest({ event: { id: 'evt' } }), revenueCat);
    expect(revenueCat.json).toHaveBeenCalledWith({ received: true });

    vi.mocked(handleRevenueCatWebhook).mockRejectedValueOnce(new RevenueCatAuthorizationError());
    const unauthorized = mockResponse();
    await revenueCatWebhook(mockRequest(), unauthorized);
    expect(unauthorized.status).toHaveBeenCalledWith(401);

    vi.mocked(handleRevenueCatWebhook).mockRejectedValueOnce(new Error('bad payload'));
    const invalid = mockResponse();
    await revenueCatWebhook(mockRequest(), invalid);
    expect(invalid.status).toHaveBeenCalledWith(400);
  });

  it('links and syncs RevenueCat, including owner and config failures', async () => {
    vi.mocked(linkRevenueCatUser).mockResolvedValue('app-user-4' as never);
    const linked = mockResponse();
    await linkRevenueCat(mockRequest({ family_group_id: 4 }, 5), linked);
    expect(linked.json).toHaveBeenCalledWith({ app_user_id: 'app-user-4' });

    vi.mocked(linkRevenueCatUser).mockRejectedValueOnce(new Error('Only the family owner can link billing'));
    const forbidden = mockResponse();
    await linkRevenueCat(mockRequest({ family_group_id: 4 }, 5), forbidden);
    expect(forbidden.status).toHaveBeenCalledWith(403);

    vi.mocked(linkRevenueCatUser).mockRejectedValueOnce(new RevenueCatConfigError('missing key'));
    const config = mockResponse();
    await linkRevenueCat(mockRequest({ family_group_id: 4 }, 5), config);
    expect(config.status).toHaveBeenCalledWith(500);
    expect(config.json).toHaveBeenCalledWith({ message: 'RevenueCat is not configured' });

    vi.mocked(linkRevenueCatUser).mockResolvedValue('app-user-4' as never);
    vi.mocked(reprocessLatestRevenueCatEvent).mockResolvedValue(undefined as never);
    vi.mocked(resolveEntitlements).mockResolvedValue({ plan: 'plus' } as never);
    const synced = mockResponse();
    await syncRevenueCat(mockRequest({ family_group_id: 4 }, 5), synced);
    expect(synced.status).toHaveBeenCalledWith(200);
    expect(synced.json).toHaveBeenCalledWith({ plan: 'plus' });
  });
});
