import express from 'express';
import * as sseController from '../controllers/sse/sse.controller.ts';
import { authenticateToken, requireFamilyMember } from '../middleware/auth.middleware.ts';

const router = express.Router();

router.use(authenticateToken);
router.use('/:family_group_id', requireFamilyMember);

/**
 * @openapi
 * /sse/{family_group_id}:
 *   get:
 *     summary: Subscribe to family-scoped server-sent events
 *     tags: [SSE]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: family_group_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: SSE stream
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/:family_group_id', (req, res, next) => {
  try {
    sseController.subscribeFamilySse(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
