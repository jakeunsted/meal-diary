import express from 'express';
import * as billingController from '../controllers/billing/billing.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';

const router = express.Router();

/**
 * @openapi
 * /billing/create-checkout-session:
 *   post:
 *     summary: Create a Stripe checkout session for a premium subscription
 *     tags: [Billing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - family_group_id
 *               - interval
 *             properties:
 *               family_group_id:
 *                 type: integer
 *                 description: The family group to subscribe
 *               interval:
 *                 type: string
 *                 enum: [month, year]
 *                 description: The billing interval
 *               success_url:
 *                 type: string
 *                 description: URL to redirect to after successful checkout
 *               cancel_url:
 *                 type: string
 *                 description: URL to redirect to if checkout is cancelled
 *     responses:
 *       200:
 *         description: The created checkout session
 *       400:
 *         description: family_group_id and interval are required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the family owner can manage billing
 *       404:
 *         description: Family group not found
 *       409:
 *         description: Trial already used, already subscribed, or billing managed by the App Store / Play Store
 *       500:
 *         description: Billing is not configured or request failed
 */
router.post('/create-checkout-session', authenticateToken, async (req, res, next) => {
  try {
    await billingController.createCheckout(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /billing/create-portal-session:
 *   post:
 *     summary: Create a Stripe customer portal session to manage a subscription
 *     tags: [Billing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - family_group_id
 *             properties:
 *               family_group_id:
 *                 type: integer
 *                 description: The family group whose subscription to manage
 *               return_url:
 *                 type: string
 *                 description: URL to return to after leaving the portal
 *     responses:
 *       200:
 *         description: The created portal session
 *       400:
 *         description: family_group_id is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the family owner can manage billing
 *       404:
 *         description: Family group not found
 *       409:
 *         description: Billing managed by the App Store / Play Store
 *       500:
 *         description: Billing is not configured or request failed
 */
router.post('/create-portal-session', authenticateToken, async (req, res, next) => {
  try {
    await billingController.createPortal(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /billing/confirm-checkout-session:
 *   post:
 *     summary: Confirm a completed Stripe checkout session and sync the subscription
 *     tags: [Billing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - family_group_id
 *               - session_id
 *             properties:
 *               family_group_id:
 *                 type: integer
 *                 description: The family group the checkout was for
 *               session_id:
 *                 type: string
 *                 description: The Stripe checkout session id
 *     responses:
 *       200:
 *         description: Whether the subscription was synced
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 synced:
 *                   type: boolean
 *       400:
 *         description: family_group_id and session_id are required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the family owner can manage billing
 *       404:
 *         description: Family group not found
 *       500:
 *         description: Billing is not configured or request failed
 */
router.post('/confirm-checkout-session', authenticateToken, async (req, res, next) => {
  try {
    await billingController.confirmCheckout(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /billing/link-revenuecat:
 *   post:
 *     summary: Link the family group to a RevenueCat app user for in-app purchases
 *     tags: [Billing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - family_group_id
 *             properties:
 *               family_group_id:
 *                 type: integer
 *                 description: The family group to link
 *     responses:
 *       200:
 *         description: The RevenueCat app user id
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 app_user_id:
 *                   type: string
 *       400:
 *         description: family_group_id is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the family owner can manage billing
 *       404:
 *         description: Family group not found
 *       500:
 *         description: RevenueCat is not configured or request failed
 */
router.post('/link-revenuecat', authenticateToken, async (req, res, next) => {
  try {
    await billingController.linkRevenueCat(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * The two webhook routes below are registered directly in index.ts (before the
 * JSON body parser) but are documented here so they appear in the API docs.
 *
 * @openapi
 * /billing/webhook:
 *   post:
 *     summary: Stripe webhook endpoint
 *     description: Receives Stripe events. Verified via the stripe-signature header; requires the raw request body.
 *     tags: [Billing]
 *     responses:
 *       200:
 *         description: Event received
 *       400:
 *         description: Invalid Stripe webhook
 * /billing/revenuecat-webhook:
 *   post:
 *     summary: RevenueCat webhook endpoint
 *     description: Receives RevenueCat subscription events. Verified via the Authorization header.
 *     tags: [Billing]
 *     responses:
 *       200:
 *         description: Event received
 *       401:
 *         description: Invalid webhook authorization
 *       400:
 *         description: Invalid RevenueCat webhook
 */

export default router;
