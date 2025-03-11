import express from 'express';
import * as familyGroupController from '../controllers/family-group/familyGroup.controller.ts';

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     FamilyGroup:
 *       type: object
 *       required:
 *         - name
 *         - created_by
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the family group
 *         name:
 *           type: string
 *           maxLength: 100
 *           description: The name of the family group
 *         created_by:
 *           type: integer
 *           description: The id of the user who created the family group
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The date the family group was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date the family group was last updated
 */

/**
 * @openapi
 * /family-groups:
 *   post:
 *     summary: Create a new family group
 *     tags: [FamilyGroups]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - created_by
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the family group
 *               created_by:
 *                 type: integer
 *                 description: The id of the user who created the family group
 *     responses:
 *       201:
 *         description: The created family group
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FamilyGroup'
 *       500:
 *         description: Failed to create family group
 */
router.post('/', async (req, res, next) => {
  try {
    await familyGroupController.createFamilyGroup(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /family-groups/{id}:
 *   get:
 *     summary: Get a family group by id
 *     tags: [FamilyGroups]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The family group id
 *     responses:
 *       200:
 *         description: The family group
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FamilyGroup'
 *       500:
 *         description: Failed to get family group
 */
router.get('/:id', async (req, res, next) => {
  try {
    await familyGroupController.getFamilyGroupById(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
