import express from 'express';

const router = express.Router();

/**
 * @openapi
 * /api/health:
 *   head:
 *     tags:
 *       - Health
 *     summary: Check API health
 *     responses:
 *       200:
 *         description: API is healthy
 */
router.head('/', (req, res) => {
  res.status(200).end();
});

export default router; 