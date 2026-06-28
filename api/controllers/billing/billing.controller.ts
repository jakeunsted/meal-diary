import type { Request, Response } from 'express';
import type User from '../../db/models/User.model.ts';
import {
  BillingAuthorizationError,
  BillingConfigError,
  confirmCheckoutSession,
  createCheckoutSession,
  createPortalSession,
  constructStripeEvent,
  handleStripeWebhook,
  TrialAlreadyUsedError,
} from '../../services/billing.service.ts';

const getFamilyGroupId = (value: unknown): number | null => {
  const familyGroupId = Number(value);
  return familyGroupId && !Number.isNaN(familyGroupId) ? familyGroupId : null;
};

const handleBillingError = (error: unknown, res: Response) => {
  if (error instanceof BillingAuthorizationError) {
    return res.status(403).json({ message: error.message });
  }

  if (error instanceof TrialAlreadyUsedError) {
    return res.status(409).json({
      code: error.code,
      message: 'You have already used your free trial',
    });
  }

  if (error instanceof BillingConfigError) {
    console.error('Billing configuration error:', error.message);
    const isRedirectError = error.message.toLowerCase().includes('redirect');
    return res.status(isRedirectError ? 400 : 500).json({
      message: isRedirectError ? error.message : 'Billing is not configured',
      code: isRedirectError ? 'CHECKOUT_REDIRECT_NOT_ALLOWED' : 'BILLING_NOT_CONFIGURED',
    });
  }

  if (error instanceof Error && error.message === 'Family group not found') {
    return res.status(404).json({ message: error.message });
  }

  console.error('Billing error:', error);
  return res.status(500).json({ message: 'Billing request failed' });
};

export const createCheckout = async (req: Request, res: Response) => {
  try {
    const familyGroupId = getFamilyGroupId(req.body.family_group_id);
    const interval = req.body.interval;
    const user = req.user as User | undefined;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!familyGroupId || (interval !== 'month' && interval !== 'year')) {
      return res.status(400).json({ message: 'family_group_id and interval are required' });
    }

    const session = await createCheckoutSession(
      familyGroupId,
      user.dataValues.id,
      interval,
      {
        successUrl: typeof req.body.success_url === 'string' ? req.body.success_url : undefined,
        cancelUrl: typeof req.body.cancel_url === 'string' ? req.body.cancel_url : undefined,
      }
    );

    return res.status(200).json(session);
  } catch (error) {
    return handleBillingError(error, res);
  }
};

export const createPortal = async (req: Request, res: Response) => {
  try {
    const familyGroupId = getFamilyGroupId(req.body.family_group_id);
    const user = req.user as User | undefined;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!familyGroupId) {
      return res.status(400).json({ message: 'family_group_id is required' });
    }

    const session = await createPortalSession(
      familyGroupId,
      user.dataValues.id,
      typeof req.body.return_url === 'string' ? req.body.return_url : undefined
    );
    return res.status(200).json(session);
  } catch (error) {
    return handleBillingError(error, res);
  }
};

export const confirmCheckout = async (req: Request, res: Response) => {
  try {
    const familyGroupId = getFamilyGroupId(req.body.family_group_id);
    const sessionId = typeof req.body.session_id === 'string' ? req.body.session_id.trim() : '';
    const user = req.user as User | undefined;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!familyGroupId || !sessionId) {
      return res.status(400).json({ message: 'family_group_id and session_id are required' });
    }

    const subscription = await confirmCheckoutSession(
      sessionId,
      familyGroupId,
      user.dataValues.id
    );

    return res.status(200).json({
      synced: Boolean(subscription),
    });
  } catch (error) {
    return handleBillingError(error, res);
  }
};

export const stripeWebhook = async (req: Request, res: Response) => {
  try {
    const event = constructStripeEvent(
      req.body as Buffer,
      req.headers['stripe-signature']
    );
    await handleStripeWebhook(event);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return res.status(400).json({ message: 'Invalid Stripe webhook' });
  }
};
