import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { type UserAttributes } from '../../db/models/User.model.ts';
import { trackEvent, getDistinctId } from '../../utils/posthog.ts';
import * as AuthService from '../../services/auth.service.ts';

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
      return;
    }
    
    try {
      const { user, tokens } = await AuthService.authenticateUser({ email, password });
      
      // Track successful login
      await trackEvent(user.id.toString(), 'login_success', {
        auth_method: 'email',
      });
      
      // Log user data for debugging
      console.log('[Login] User data:', {
        id: user.id,
        email: user.email,
        username: user.username,
        family_group_id: user.family_group_id,
        hasFamilyGroup: !!user.family_group_id
      });
      
      // Return user data and tokens
      res.status(200).json({
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });
    } catch (authError) {
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
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
    const distinctId = getDistinctId(req);
    await trackEvent(distinctId, 'login_failure', {
      reason: 'server_error',
    });
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
    
    console.log('[Refresh Token Controller] Received refresh request:', {
      hasToken: !!refreshToken,
      tokenLength: refreshToken?.length,
      tokenPreview: refreshToken ? `${refreshToken.substring(0, 20)}...` : 'none'
    });
    
    if (!refreshToken) {
      console.error('[Refresh Token Controller] No refresh token provided');
      res.status(400).json({ message: 'Refresh token is required' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'token_refresh_failure', {
        reason: 'missing_token',
      });
      return;
    }
    
    try {
      const { user, tokens } = await AuthService.refreshUserTokens(refreshToken);
      
      console.log('[Refresh Token Controller] Token refresh successful:', {
        userId: user.id,
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken
      });
      
      // Track successful token refresh
      await trackEvent(user.id.toString(), 'token_refresh_success', {});
      
      res.status(200).json({
        ...tokens,
        user
      });
    } catch (serviceError) {
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
      
      console.error('[Refresh Token Controller] Service error:', {
        error: errorMessage,
        reason,
        statusCode
      });
      
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
      user
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
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'google_oauth_callback_failure', {
        reason: 'invalid_state',
      });
      res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
      return;
    }

    // Clear state cookie
    res.clearCookie('oauth_state');

    if (!code) {
      console.error('[Google OAuth] No authorization code received');
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'google_oauth_callback_failure', {
        reason: 'no_code',
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

      // Generate JWT tokens
      const tokens = await AuthService.generateTokens(user.id);

      // Track successful Google OAuth callback
      await trackEvent(user.id.toString(), 'google_oauth_callback_success', {
        is_new_user: isNewUser,
      });

      // Also track as login success
      await trackEvent(user.id.toString(), 'login_success', {
        auth_method: 'google',
      });

      // Prepare user data (exclude password_hash)
      const userData = {
        id: user.id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        family_group_id: user.family_group_id,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        updated_at: user.updated_at
      };

      // Log user data for debugging
      console.log('[Google OAuth] User authenticated:', {
        id: user.id,
        email: user.email,
        username: user.username,
        family_group_id: user.family_group_id,
        hasFamilyGroup: !!user.family_group_id
      });

      // Redirect to frontend callback page with tokens and user data
      const redirectUrl = `${FRONTEND_URL}/auth/google/callback?` +
        `accessToken=${encodeURIComponent(tokens.accessToken)}&` +
        `refreshToken=${encodeURIComponent(tokens.refreshToken)}&` +
        `user=${encodeURIComponent(JSON.stringify(userData))}`;

      res.redirect(redirectUrl);
    } catch (serviceError) {
      console.error('[Google OAuth] Service error:', serviceError);
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'OAuth failed';
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'google_oauth_callback_failure', {
        reason: 'server_error',
      });
      res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
    }
  } catch (error) {
    console.error('[Google OAuth] Callback error:', error);
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
    const distinctId = getDistinctId(req);
    await trackEvent(distinctId, 'google_oauth_callback_failure', {
      reason: 'server_error',
    });
    res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }
};
