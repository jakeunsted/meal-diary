import express from 'express';
import * as userController from '../controllers/user/userController.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';

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
 *       properties:
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
 *         description: Username, email, and password are required
 *       409:
 *         description: User with this username or email already exists
 *       500:
 *         description: Failed to create user
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
 * /users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: The list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       500:
 *         description: Failed to fetch users
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    await userController.getAllUsers(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get a user by id
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
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to fetch user
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
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
 *     summary: Update a user
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
 *     responses:
 *       200:
 *         description: The updated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       409:
 *         description: Username or email already in use
 *       500:
 *         description: Failed to update user
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    await userController.updateUser(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     summary: Delete a user
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
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User deleted successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to delete user
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    await userController.deleteUser(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;

