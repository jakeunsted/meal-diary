import { Router, type RequestHandler } from 'express';
import { login, refreshToken, logout, validateToken } from '../controllers/auth/auth.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';

const router = Router();

/**
 * Helper function to wrap controller functions with error handling.
 * @param {RequestHandler} handler - The controller function to wrap.
 * @returns {RequestHandler} - A wrapped controller function.
 */
const wrapHandler = (handler: RequestHandler): RequestHandler => {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Login route to authenticate users.
 * @swagger
 * /login:
 *   post:
 *     summary: Authenticate user and issue tokens.
 *     description: Authenticates a user and issues access and refresh tokens.
 *     requestBody:
 *       description: User credentials.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: The user's username.
 *               password:
 *                 type: string
 *                 description: The user's password.
 *     responses:
 *       200:
 *         description: Authentication successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: The access token.
 *                 refreshToken:
 *                   type: string
 *                   description: The refresh token.
 *       401:
 *         description: Authentication failed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 */
router.post('/login', wrapHandler(login));

/**
 * Refresh token route to issue new tokens.
 * @swagger
 * /refresh-token:
 *   post:
 *     summary: Refresh user tokens.
 *     description: Refreshes user tokens using the refresh token.
 *     requestBody:
 *       description: Refresh token.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: The refresh token.
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: The new access token.
 *                 refreshToken:
 *                   type: string
 *                   description: The new refresh token.
 *       401:
 *         description: Token refresh failed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 */
router.post('/refresh-token', wrapHandler(refreshToken));

/**
 * Logout route to invalidate tokens.
 * @swagger
 * /logout:
 *   post:
 *     summary: Logout user.
 *     description: Invalidates the user's tokens.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message.
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message.
 */
router.post('/logout', authenticateToken, wrapHandler(logout));

/**
 * Validate token route to check token validity.
 * @swagger
 * /validate:
 *   get:
 *     summary: Validate access token.
 *     description: Checks if the current access token is valid.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   description: Whether the token is valid.
 *                 user:
 *                   type: object
 *                   description: User data if token is valid.
 *       401:
 *         description: Token is invalid.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   description: Whether the token is valid.
 *                 message:
 *                   type: string
 *                   description: Error message.
 */
router.get('/validate', authenticateToken, wrapHandler(validateToken));

export default router; 
