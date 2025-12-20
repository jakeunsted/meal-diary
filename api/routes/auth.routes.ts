import { Router, type RequestHandler } from 'express';
import { login, refreshToken, logout, validateToken, initiateGoogleAuth, handleGoogleCallback } from '../controllers/auth/auth.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';
import { loginLimiter, refreshTokenLimiter, validateTokenLimiter, logoutLimiter } from '../middleware/rateLimit.middleware.ts';

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
router.post('/login', loginLimiter, wrapHandler(login));

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
router.post('/refresh-token', refreshTokenLimiter, wrapHandler(refreshToken));

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
router.post('/logout', logoutLimiter, authenticateToken, wrapHandler(logout));

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
router.get('/validate', validateTokenLimiter, authenticateToken, wrapHandler(validateToken));

/**
 * Google OAuth initiation route
 * @swagger
 * /google:
 *   get:
 *     summary: Initiate Google OAuth flow
 *     description: Redirects user to Google OAuth consent screen
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth
 *       500:
 *         description: Server error
 */
router.get('/google', loginLimiter, wrapHandler(initiateGoogleAuth));

/**
 * Google OAuth callback route
 * @swagger
 * /google/callback:
 *   get:
 *     summary: Handle Google OAuth callback
 *     description: Processes Google OAuth callback and authenticates user
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from Google
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: State parameter for CSRF protection
 *     responses:
 *       302:
 *         description: Redirect to frontend with tokens
 *       500:
 *         description: Server error
 */
router.get('/google/callback', loginLimiter, wrapHandler(handleGoogleCallback));

export default router; 
