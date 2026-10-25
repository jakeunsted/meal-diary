import { Router, type RequestHandler } from 'express';
import { login, refreshToken, logout, validateToken, initiateGoogleAuth, handleGoogleCallback, exchangeGoogleOAuthCode, forgotPassword, resetPassword, linkOAuthAccount } from '../controllers/auth/auth.controller.ts';
import { verifyGoogleToken } from '../controllers/auth/googleTokenVerification.controller.ts';
import { verifyAppleToken } from '../controllers/auth/appleTokenVerification.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';
import { loginLimiter, refreshTokenLimiter, validateTokenLimiter, logoutLimiter, passwordResetLimiter } from '../middleware/rateLimit.middleware.ts';

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
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The user's email address.
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
 *                 user:
 *                   type: object
 *                   description: User data
 *                 accessToken:
 *                   type: string
 *                   description: The access token.
 *                 refreshToken:
 *                   type: string
 *                   description: The refresh token.
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email and password are required
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
 *                   example: Invalid credentials
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Server error during login
 */
router.post('/login', loginLimiter, wrapHandler(login));

/**
 * @swagger
 * /forgot-password:
 *   post:
 *     summary: Request a password reset email.
 *     description: Always returns the same message so the response does not reveal whether the email exists.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset instructions were processed.
 *       400:
 *         description: Email is missing.
 *       429:
 *         description: Too many password reset attempts.
 */
router.post('/forgot-password', passwordResetLimiter, wrapHandler(forgotPassword));

/**
 * @swagger
 * /reset-password:
 *   post:
 *     summary: Set a new password with a reset token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated.
 *       400:
 *         description: Token is invalid or the password does not meet requirements.
 *       429:
 *         description: Too many password reset attempts.
 */
router.post('/reset-password', passwordResetLimiter, wrapHandler(resetPassword));

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
 *                 user:
 *                   type: object
 *                   description: User data
 *                 accessToken:
 *                   type: string
 *                   description: The new access token.
 *                 refreshToken:
 *                   type: string
 *                   description: The new refresh token.
 *       400:
 *         description: Missing refresh token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Refresh token is required
 *       401:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User not found
 *       403:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid or expired refresh token
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Server error during token refresh
 */
// NOTE: Refresh token route currently has NO rate limiting applied.
// Nuxt SSR can trigger multiple refreshes during normal navigation,
// so we temporarily disable the limiter here to avoid 429s.
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
 *         description: Redirect to Google OAuth consent screen
 *       500:
 *         description: Server error or OAuth not configured
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Google OAuth not configured
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
 *         description: Redirect to frontend with tokens or error
 *         headers:
 *           Location:
 *             description: Redirect URL with tokens (success) or error query param (failure)
 *             schema:
 *               type: string
 *               examples:
 *                 success: /auth/google/callback?exchangeCode=...
 *                 error: /login?error=invalid_state
 *       500:
 *         description: Server error
 */
router.get('/google/callback', loginLimiter, wrapHandler(handleGoogleCallback));

/**
 * Exchange a one-time OAuth code from the web Google callback redirect for session tokens.
 * @swagger
 * /google/exchange:
 *   post:
 *     summary: Exchange OAuth one-time code for tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authentication successful
 *       400:
 *         description: Invalid or expired exchange code
 */
router.post('/google/exchange', loginLimiter, wrapHandler(exchangeGoogleOAuthCode));

/**
 * Google OAuth ID token verification route (for native apps)
 * @swagger
 * /google/verify-token:
 *   post:
 *     summary: Verify Google ID token and authenticate user
 *     description: Verifies a Google ID token from native app and authenticates the user
 *     requestBody:
 *       description: Google ID token
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google ID token from native authentication
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   description: User data
 *                 accessToken:
 *                   type: string
 *                   description: The access token
 *                 refreshToken:
 *                   type: string
 *                   description: The refresh token
 *       400:
 *         description: Invalid token or missing email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   examples:
 *                     - ID token is required
 *                     - No email in Google profile
 *       401:
 *         description: Invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid token
 *       500:
 *         description: Server error or OAuth not configured
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Server error during token verification
 */
router.post('/google/verify-token', loginLimiter, wrapHandler(verifyGoogleToken));

/**
 * Sign in with Apple identity token verification (native iOS)
 * @swagger
 * /apple/verify-token:
 *   post:
 *     summary: Verify an Apple identity token and authenticate the user
 *     description: Verifies a Sign in with Apple identity token from the iOS app and authenticates the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *               - nonce
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Apple identity token
 *               nonce:
 *                 type: string
 *                 description: Raw nonce whose SHA-256 hex digest was sent to Apple
 *               givenName:
 *                 type: string
 *                 description: Given name from the first Apple authorization
 *               familyName:
 *                 type: string
 *                 description: Family name from the first Apple authorization
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Missing token, nonce, or email
 *       401:
 *         description: Invalid token or nonce
 *       500:
 *         description: Server error or Sign in with Apple not configured
 */
router.post('/apple/verify-token', loginLimiter, wrapHandler(verifyAppleToken));

router.post('/oauth/link', loginLimiter, wrapHandler(linkOAuthAccount));

export default router; 
