import express from 'express';
import * as familyGroupController from '../controllers/family-group/familyGroup.controller.ts';
import * as entitlementsController from '../controllers/entitlements/entitlements.controller.ts';
import { authenticateToken, requireFamilyMember } from '../middleware/auth.middleware.ts';

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
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the family group
 *     responses:
 *       201:
 *         description: The created family group (creator is the authenticated user)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FamilyGroup'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to create family group
 */
router.post('/', authenticateToken, async (req, res, next) => {
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
 *       400:
 *         description: Invalid family group id
 *       403:
 *         description: Forbidden — members only
 *       404:
 *         description: Family group not found
 *       500:
 *         description: Failed to get family group
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    await familyGroupController.getFamilyGroupById(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /family-groups/join:
 *   post:
 *     summary: Join a family group
 *     tags: [FamilyGroups]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - random_identifier
 *             properties:
 *               random_identifier:
 *                 type: string
 *                 description: The random identifier of the family group
 *     responses:
 *       200:
 *         description: The authenticated user has been added to the family group
 *       400:
 *         description: User already in the family group
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Family group not found
 *       412:
 *         description: Validation error
 *       500:
 *         description: Failed to join family group
 */
router.post('/join', authenticateToken, async (req, res, next) => {
  try {
    await familyGroupController.joinFamilyGroup(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /family-groups/{id}/members:
 *   get:
 *     summary: Get all members of a family group
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
 *         description: List of family group members
 *       400:
 *         description: Invalid family group id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — members only
 *       404:
 *         description: Family group not found
 *       500:
 *         description: Failed to get family group members
 */
router.get('/:id/members', authenticateToken, async (req, res, next) => {
  try {
    await familyGroupController.getFamilyGroupMembers(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /family-groups/{family_group_id}/leave:
 *   post:
 *     summary: Leave a family group (members only; the owner must transfer or delete instead)
 *     tags: [FamilyGroups]
 *     parameters:
 *       - in: path
 *         name: family_group_id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Left the family group; shared data remains with the group
 *       403:
 *         description: Forbidden — not a member
 *       404:
 *         description: Family group not found
 *       409:
 *         description: The owner cannot leave — transfer ownership or delete the family first
 *       500:
 *         description: Failed to leave family group
 */
router.post('/:family_group_id/leave', authenticateToken, requireFamilyMember, async (req, res, next) => {
  try {
    await familyGroupController.leaveFamilyGroup(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /family-groups/{family_group_id}/transfer-ownership:
 *   post:
 *     summary: Transfer family group ownership to another member (owner only)
 *     tags: [FamilyGroups]
 *     parameters:
 *       - in: path
 *         name: family_group_id
 *         schema:
 *           type: integer
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - new_owner_id
 *             properties:
 *               new_owner_id:
 *                 type: integer
 *                 description: The member to become the new owner
 *     responses:
 *       200:
 *         description: Ownership transferred
 *       400:
 *         description: Invalid or non-member new owner
 *       403:
 *         description: Only the family owner can transfer ownership
 *       404:
 *         description: Family group not found
 *       500:
 *         description: Failed to transfer ownership
 */
router.post('/:family_group_id/transfer-ownership', authenticateToken, requireFamilyMember, async (req, res, next) => {
  try {
    await familyGroupController.transferFamilyGroupOwnership(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /family-groups/{family_group_id}:
 *   delete:
 *     summary: Delete a family group and all of its data (owner only)
 *     tags: [FamilyGroups]
 *     parameters:
 *       - in: path
 *         name: family_group_id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Family group, meal diaries, shopping lists, and recipes deleted; members unlinked
 *       403:
 *         description: Only the family owner can delete the family group
 *       404:
 *         description: Family group not found
 *       500:
 *         description: Failed to delete family group
 */
router.delete('/:family_group_id', authenticateToken, requireFamilyMember, async (req, res, next) => {
  try {
    await familyGroupController.deleteFamilyGroup(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /family-groups/{family_group_id}/entitlements:
 *   get:
 *     summary: Get the resolved entitlements for a family group
 *     tags: [FamilyGroups]
 *     parameters:
 *       - in: path
 *         name: family_group_id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The family group id
 *     responses:
 *       200:
 *         description: The family group's entitlements (plan, status, and feature limits)
 *       400:
 *         description: Invalid family group ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — members only
 *       500:
 *         description: Failed to get entitlements
 */
router.get('/:family_group_id/entitlements', authenticateToken, requireFamilyMember, async (req, res, next) => {
  try {
    await entitlementsController.getFamilyEntitlements(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /family-groups/{family_group_id}/entitlements/dismiss-prompt:
 *   post:
 *     summary: Dismiss an entitlement prompt for a family group (owner only)
 *     tags: [FamilyGroups]
 *     parameters:
 *       - in: path
 *         name: family_group_id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The family group id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 enum: [trial_expired]
 *                 description: The prompt type to dismiss
 *     responses:
 *       200:
 *         description: The refreshed entitlements after dismissing the prompt
 *       400:
 *         description: Invalid family group ID or prompt type
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the family owner can dismiss prompts
 *       404:
 *         description: Family group not found
 *       500:
 *         description: Failed to dismiss prompt
 */
router.post('/:family_group_id/entitlements/dismiss-prompt', authenticateToken, requireFamilyMember, async (req, res, next) => {
  try {
    await entitlementsController.dismissEntitlementPrompt(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
