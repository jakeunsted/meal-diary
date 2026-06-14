import express from 'express';
import * as userController from '../controllers/user/user.controller.ts';
import { authenticateToken, requireSelf } from '../middleware/auth.middleware.ts';

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - email
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the user
 *         username:
 *           type: string
 *           maxLength: 50
 *           description: The username of the user
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 100
 *           description: The email of the user
 *         first_name:
 *           type: string
 *           maxLength: 50
 *           nullable: true
 *           description: The first name of the user
 *         last_name:
 *           type: string
 *           maxLength: 50
 *           nullable: true
 *           description: The last name of the user
 *         family_group_id:
 *           type: integer
 *           nullable: true
 *           description: The id of the family group the user belongs to
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The date the user was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date the user was last updated
 *     UserInput:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *         - terms_accepted
 *       properties:
 *         terms_accepted:
 *           type: boolean
 *           description: Must be true — records acceptance of the terms of service and privacy policy
 *         username:
 *           type: string
 *           maxLength: 50
 *           description: The username of the user
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 100
 *           description: The email of the user
 *         password:
 *           type: string
 *           format: password
 *           description: The password of the user
 *         first_name:
 *           type: string
 *           maxLength: 50
 *           nullable: true
 *           description: The first name of the user
 *         last_name:
 *           type: string
 *           maxLength: 50
 *           nullable: true
 *           description: The last name of the user
 *         family_group_id:
 *           type: integer
 *           nullable: true
 *           description: The id of the family group the user belongs to
 *         family_group_code:
 *           type: string
 *           nullable: true
 *           description: The code of the family group the user belongs to
 *         avatar_url:
 *           type: string
 *           nullable: true
 *           description: The url of the user's avatar
 */

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserInput'
 *     responses:
 *       201:
 *         description: The created user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Username, email, and password are required
 *       404:
 *         description: Family group not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Family group not found
 *       409:
 *         description: User with this username or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User with this username or email already exists
 *       500:
 *         description: Failed to create user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Failed to create user
 */
router.post('/', async (req, res, next) => {
  try {
    await userController.createUser(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /users/me:
 *   delete:
 *     summary: Permanently delete the authenticated user's account and personal data
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Required for accounts with a password
 *               confirmation:
 *                 type: string
 *                 description: Must be "DELETE" for Google-only accounts
 *     responses:
 *       200:
 *         description: Account deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Missing confirmation
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Password is incorrect
 *       409:
 *         description: User created a family group that still has other members
 *       500:
 *         description: Failed to delete account
 */
router.delete('/me', authenticateToken, async (req, res, next) => {
  try {
    await userController.deleteOwnAccount(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /users/me/export:
 *   get:
 *     summary: Export all data linked to the authenticated user (GDPR Art. 15/20)
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: JSON attachment containing the user's profile and family-group data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exportedAt:
 *                   type: string
 *                   format: date-time
 *                 user:
 *                   type: object
 *                 familyGroup:
 *                   type: object
 *                   nullable: true
 *                 recipes:
 *                   type: array
 *                   items: { type: object }
 *                 mealDiaries:
 *                   type: array
 *                   items: { type: object }
 *                 shoppingLists:
 *                   type: array
 *                   items: { type: object }
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to export data
 */
router.get('/me/export', authenticateToken, async (req, res, next) => {
  try {
    await userController.exportOwnData(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get a user by id (own account only)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The user id
 *     responses:
 *       200:
 *         description: The user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden — can only access your own account
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to fetch user
 */
router.get('/:id', authenticateToken, requireSelf, async (req, res, next) => {
  try {
    await userController.getUserById(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     summary: Update a user (own account only)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The user id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 maxLength: 50
 *                 description: The username of the user
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 100
 *                 description: The email of the user
 *               first_name:
 *                 type: string
 *                 maxLength: 50
 *                 nullable: true
 *                 description: The first name of the user
 *               last_name:
 *                 type: string
 *                 maxLength: 50
 *                 nullable: true
 *                 description: The last name of the user
 *               family_group_id:
 *                 type: integer
 *                 nullable: true
 *                 description: The id of the family group the user belongs to
 *               avatar_url:
 *                 type: string
 *                 nullable: true
 *                 description: The url of the user's avatar
 *     responses:
 *       200:
 *         description: The updated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden — can only update your own account
 *       404:
 *         description: User not found
 *       409:
 *         description: Username or email already in use
 *       500:
 *         description: Failed to update user
 */
router.put('/:id', authenticateToken, requireSelf, async (req, res, next) => {
  try {
    await userController.updateUser(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;

