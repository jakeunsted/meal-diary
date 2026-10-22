import express from 'express';
import type { Request } from 'express';
import { FEATURE_FLAGS } from '@meal-diary/shared';
import { authenticateToken } from '../middleware/auth.middleware.ts';
import { requireFeatureFlag } from '../middleware/featureFlag.middleware.ts';
import {
  authorizeAlexaLink,
  deleteAlexaLink,
  getAlexaLink,
} from '../controllers/alexa/alexaOAuth.controller.ts';

export const alexaSkillJson = express.json({
  verify: (req, _res, buf) => {
    (req as Request).rawBody = Buffer.from(buf);
  },
});

export const alexaTokenUrlencoded = express.urlencoded({ extended: false });

const router = express.Router();

router.get(
  '/link',
  authenticateToken,
  requireFeatureFlag(FEATURE_FLAGS.alexaConnection),
  getAlexaLink
);

router.delete(
  '/link',
  authenticateToken,
  requireFeatureFlag(FEATURE_FLAGS.alexaConnection),
  deleteAlexaLink
);

router.post(
  '/oauth/authorize',
  authenticateToken,
  requireFeatureFlag(FEATURE_FLAGS.alexaConnection),
  authorizeAlexaLink
);

export default router;
