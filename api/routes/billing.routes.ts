import express from 'express';
import * as billingController from '../controllers/billing/billing.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';

const router = express.Router();

router.post('/create-checkout-session', authenticateToken, async (req, res, next) => {
  try {
    await billingController.createCheckout(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/create-portal-session', authenticateToken, async (req, res, next) => {
  try {
    await billingController.createPortal(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/confirm-checkout-session', authenticateToken, async (req, res, next) => {
  try {
    await billingController.confirmCheckout(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
