import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { type UserAttributes } from '../../db/models/User.model.ts';
import { trackEvent, getDistinctId, sanitizeErrorForAnalytics } from '../../utils/posthog.ts';
import { trackAuthLog, logAuth } from '../../utils/otelLogs.ts';
import * as AuthService from '../../services/auth.service.ts';
import { buildAuthResponse } from '../../services/authResponse.service.ts';
import { PasswordAccountLinkRequiredError } from '../../services/passwordLinkError.ts';
import { sanitizeUser } from '../../services/user.service.ts';
import {
  completePasswordReset,
  INVALID_RESET_LINK_MESSAGE,
  PASSWORD_REQUIREMENTS_MESSAGE,
  requestPasswordReset,
} from '../../services/passwordReset.service.ts';
import { INTERNAL_SERVER_ERROR_MESSAGE, isInfrastructureError } from '../../utils/clientError.ts';

const FORGOT_PASSWORD_MESSAGE = 'If an account exists for that email, we sent password reset instructions.';

/**
 * Login controller
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {Promise<void>}
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'login_failure', {
        reason: 'missing_fields',
      });
      logAuth(req, 'warn', 'login_failure', { event: 'login_failure', reason: 'missing_fields' });
      return;
    }
    
    try {
      const { user, tokens } = await AuthService.authenticateUser({ email, password });
      
      // Track successful login
      await trackEvent(user.id.toString(), 'login_success', {
        auth_method: 'email',
      });

      const response = await buildAuthResponse(user as User & UserAttributes, tokens);
      res.status(200).json(response);
    } catch (authError) {
      if (isInfrastructureError(authError)) {
        res.status(500).json({ message: INTERNAL_SERVER_ERROR_MESSAGE });
        return;
      }

      const errorMessage = authError instanceof Error ? authError.message : 'Invalid credentials';
      const statusCode = errorMessage.includes('required') ? 400 : 401;
      
      res.status(statusCode).json({ message: errorMessage });
      
      // Determine failure reason for tracking
      let reason = 'invalid_credentials';
      if (errorMessage.includes('required')) {
        reason = 'missing_fields';
      } else if (errorMessage.includes('Google')) {
        reason = 'no_password';
      } else if (errorMessage.includes('not found')) {
        reason = 'user_not_found';
      }
      
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'login_failure', {
        reason,
      });
      logAuth(req, 'warn', 'login_failure', { event: 'login_failure', reason });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
    const distinctId = getDistinctId(req);
    await trackEvent(distinctId, 'login_failure', {
      reason: 'server_error',
    });
    logAuth(req, 'error', 'login_failure', { event: 'login_failure', reason: 'server_error' });
  }
};

/**
 * Refresh token controller
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {Promise<void>}
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({ message: 'Refresh token is required' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'token_refresh_failure', {
        reason: 'missing_token',
      });
      logAuth(req, 'warn', 'token_refresh_failure', { event: 'token_refresh_failure', reason: 'missing_token' });
      return;
    }
    
    try {
      const { user, tokens } = await AuthService.refreshUserTokens(refreshToken);
      
      // Track successful token refresh
      await trackEvent(user.id.toString(), 'token_refresh_success', {});
      
      const response = await buildAuthResponse(user as User & UserAttributes, tokens);
      res.status(200).json(response);
    } catch (serviceError) {
      if (isInfrastructureError(serviceError)) {
        res.status(500).json({ message: INTERNAL_SERVER_ERROR_MESSAGE });
        return;
      }

      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Invalid or expired refresh token';
      
      // Determine failure reason for tracking
      let reason = 'invalid_token';
      let statusCode = 403;
      
      if (errorMessage.includes('required')) {
        reason = 'missing_token';
        statusCode = 400;
      } else if (errorMessage.includes('not configured')) {
        reason = 'server_error';
        statusCode = 500;
      } else if (errorMessage.includes('User not found')) {
        reason = 'user_not_found';
        statusCode = 401;
      } else if (errorMessage.includes('expired')) {
        reason = 'expired_token';
      }
      
      res.status(statusCode).json({ message: errorMessage });
      
      // Try to get userId from token for tracking
      let distinctId = getDistinctId(req);
      try {
        const refreshSecret = process.env.JWT_REFRESH_SECRET;
        if (refreshSecret) {
          const decoded = jwt.verify(refreshToken, refreshSecret) as { userId: number };
          distinctId = decoded.userId.toString();
        }
      } catch {
        // Use request distinctId if token decode fails
      }
      
      await trackEvent(distinctId, 'token_refresh_failure', {
        reason,
      });
      logAuth(req, statusCode >= 500 ? 'error' : 'warn', 'token_refresh_failure', {
        event: 'token_refresh_failure',
        reason,
      });
    }
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      console.error('[Refresh Token Controller] JWT error in catch block:', {
        error: err.message,
        name: err.name
      });
      res.status(403).json({ message: 'Invalid or expired refresh token' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'token_refresh_failure', {
        reason: 'invalid_token',
      });
      logAuth(req, 'warn', 'token_refresh_failure', { event: 'token_refresh_failure', reason: 'invalid_token' });
      return;
    }
    const error = err as Error;
    console.error('[Refresh Token Controller] Unexpected error:', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Server error during token refresh' });
    const distinctId = getDistinctId(req);
    await trackEvent(distinctId, 'token_refresh_failure', {
      reason: 'server_error',
    });
    logAuth(req, 'error', 'token_refresh_failure', { event: 'token_refresh_failure', reason: 'server_error' });
  }
};

/**
 * Logout controller
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {Promise<void>}
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User & UserAttributes;
    const refreshToken = req.body.refreshToken;
    
    await AuthService.revokeRefreshToken(refreshToken);
    
    // Track successful logout
    if (user) {
      await trackEvent(user.id.toString(), 'logout_success', {});
    }
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during logout' });
    const user = req.user as User & UserAttributes;
    if (user) {
      await trackEvent(user.id.toString(), 'logout_failure', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

/**
 * Validate token controller
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {Promise<void>}
 */
export const validateToken = async (req: Request, res: Response): Promise<void> => {
  try {
    // The authenticateToken middleware has already verified the token
    // and attached the user to the request
    const user = req.user as User & UserAttributes;

    // Track successful token validation
    if (user) {
      await trackEvent(user.id.toString(), 'token_validation_success', {});
    }

    res.status(200).json({
      valid: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(401).json({
      valid: false,
      message: 'Invalid token'
    });
    const distinctId = getDistinctId(req);
    await trackEvent(distinctId, 'token_validation_failure', {
      reason: 'invalid_token',
    });
  }
};

/**
 * Initiate Google OAuth flow
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {Promise<void>}
 */
export const initiateGoogleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback';
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

    if (!GOOGLE_CLIENT_ID) {
      res.status(500).json({ message: 'Google OAuth not configured' });
      return;
    }

    // Track Google OAuth initiation
    const distinctId = getDistinctId(req);
    await trackEvent(distinctId, 'google_oauth_initiated', {});

    // Generate state parameter for CSRF protection
    const state = AuthService.generateOAuthState();
    
    // Store state in a cookie or return it to be stored client-side
    // For simplicity, we'll include it in the redirect URL and validate it in callback
    const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(GOOGLE_CALLBACK_URL)}&` +
      `response_type=code&` +
      `scope=openid email profile&` +
      `state=${state}&` +
      `access_type=offline&` +
      `prompt=consent`;

    // Store state in response cookie for validation
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600000 // 10 minutes
    });

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Google OAuth initiation error:', error);
    res.status(500).json({ message: 'Server error during Google OAuth initiation' });
  }
};

/**
 * Handle Google OAuth callback
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {Promise<void>}
 */
export const handleGoogleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state } = req.query;
    const storedState = req.cookies?.oauth_state;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

    // Validate state parameter for CSRF protection
    if (!state || state !== storedState) {
      console.error('[Google OAuth] Invalid state parameter');
      await trackAuthLog(req, 'google_oauth_callback_failure', {
        reason: 'invalid_state',
        error_type: 'invalid_state',
        error_message: 'Invalid authentication state',
        flow: 'web_oauth_callback',
      });
      res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
      return;
    }

    // Clear state cookie
    res.clearCookie('oauth_state');

    if (!code) {
      console.error('[Google OAuth] No authorization code received');
      await trackAuthLog(req, 'google_oauth_callback_failure', {
        reason: 'no_code',
        error_type: 'no_code',
        error_message: 'Authorization code not received',
        flow: 'web_oauth_callback',
      });
      res.redirect(`${FRONTEND_URL}/login?error=no_code`);
      return;
    }

    try {
      // Exchange authorization code for access token and fetch profile
      const { profile } = await AuthService.exchangeGoogleCode(code as string);

      // Check if user exists before creating
      const existingUser = await User.findOne({ where: { email: profile.email?.toLowerCase() } });
      const isNewUser = !existingUser;

      // Find or create user using service
      const user = await AuthService.findOrCreateGoogleUser(profile);

      // One-time exchange code — never put JWTs in the redirect URL
      const exchangeCode = await AuthService.createOAuthExchangeCode(user.id);

      // Track successful Google OAuth callback
      await trackEvent(user.id.toString(), 'google_oauth_callback_success', {
        is_new_user: isNewUser,
      });

      // Also track as login success
      await trackEvent(user.id.toString(), 'login_success', {
        auth_method: 'google',
      });

      const redirectUrl =
        `${FRONTEND_URL}/auth/google/callback?exchangeCode=${encodeURIComponent(exchangeCode)}`;

      res.redirect(redirectUrl);
    } catch (serviceError) {
      if (serviceError instanceof PasswordAccountLinkRequiredError) {
        res.redirect(`${FRONTEND_URL}/login?linkToken=${encodeURIComponent(serviceError.linkToken)}`);
        return;
      }

      console.error('[Google OAuth] Service error:', serviceError);
      const { error_message, error_type } = sanitizeErrorForAnalytics(serviceError);
      await trackAuthLog(req, 'google_oauth_callback_failure', {
        reason: 'server_error',
        error_type,
        error_message,
        flow: 'web_oauth_callback',
      });
      res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
    }
  } catch (error) {
    console.error('[Google OAuth] Callback error:', error);
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
    const { error_message, error_type } = sanitizeErrorForAnalytics(error);
    await trackAuthLog(req, 'google_oauth_callback_failure', {
      reason: 'server_error',
      error_type,
      error_message,
      flow: 'web_oauth_callback',
    });
    res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }
};

/**
 * Request a password reset email.
 * Always returns the same success message so callers cannot tell whether the email exists.
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const email = req.body?.email;

  if (typeof email !== 'string' || !email.trim()) {
    res.status(400).json({ message: 'Email is required' });
    return;
  }

  const client = typeof req.body?.client === 'string' ? req.body.client : undefined;

  try {
    await requestPasswordReset(email, client);
    res.status(200).json({ message: FORGOT_PASSWORD_MESSAGE });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
};

/**
 * Exchange a one-time OAuth code (from the Google web callback redirect) for session tokens.
 */
export const exchangeGoogleOAuthCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!code) {
      res.status(400).json({ message: 'Exchange code is required' });
      return;
    }

    const { user, tokens } = await AuthService.exchangeOAuthCode(code);
    const response = await buildAuthResponse(user, tokens);
    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid or expired exchange code';
    if (
      message === 'Exchange code is required' ||
      message === 'Invalid or expired exchange code' ||
      message === 'User not found'
    ) {
      res.status(400).json({ message: 'Invalid or expired exchange code' });
      return;
    }

    console.error('OAuth exchange error:', error);
    res.status(500).json({ message: 'Server error during OAuth exchange' });
  }
};

/**
 * Set a new password from a one-time reset token.
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const token = req.body?.token;
  const password = req.body?.password;

  if (typeof token !== 'string' || !token || typeof password !== 'string' || !password) {
    res.status(400).json({ message: 'Token and password are required' });
    return;
  }

  try {
    await completePasswordReset(token, password);
    res.status(200).json({ message: 'Password updated' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reset password';
    if (message === INVALID_RESET_LINK_MESSAGE || message === PASSWORD_REQUIREMENTS_MESSAGE) {
      res.status(400).json({ message });
      return;
    }

    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
};

/**
 * Prove the current password and link the pending Google or Apple identity.
 */
export const linkOAuthAccount = async (req: Request, res: Response): Promise<void> => {
  const linkToken = req.body?.linkToken;
  const password = req.body?.password;

  if (typeof linkToken !== 'string' || !linkToken || typeof password !== 'string' || !password) {
    res.status(400).json({ message: 'Link token and password are required' });
    return;
  }

  try {
    const { user, tokens } = await AuthService.completeOAuthAccountLink(linkToken, password);
    const response = await buildAuthResponse(user, tokens);
    res.status(200).json(response);
  } catch (error) {
    if (isInfrastructureError(error)) {
      res.status(500).json({ message: INTERNAL_SERVER_ERROR_MESSAGE });
      return;
    }

    const message = error instanceof Error ? error.message : 'Invalid or expired link';
    if (message === 'Incorrect password') {
      res.status(401).json({ message });
      return;
    }
    if (message.includes('already linked')) {
      res.status(409).json({ message });
      return;
    }
    if (message.includes('required') || message === 'Invalid or expired link') {
      res.status(400).json({ message });
      return;
    }

    console.error('OAuth account link error:', error);
    res.status(500).json({ message: 'Server error during account link' });
  }
};
