import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User, { type UserAttributes } from '../../db/models/User.model.ts';
import RefreshToken from '../../db/models/RefreshToken.model.ts';
import { Op } from 'sequelize';
import crypto from 'crypto';
import axios from 'axios';
import { trackEvent, getDistinctId } from '../../utils/posthog.ts';

/**
 * Find or create user from Google profile data
 * @param {Object} googleProfile - Google profile data
 * @returns {Promise<User & UserAttributes>} The user object
 */
export const findOrCreateGoogleUser = async (googleProfile: {
  id: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  name?: string;
}) => {
  const googleId = googleProfile.id;
  const email = googleProfile.email?.toLowerCase();
  const firstName = googleProfile.given_name;
  const lastName = googleProfile.family_name;
  const avatarUrl = googleProfile.picture;

  if (!email) {
    throw new Error('No email in Google profile');
  }

  // Find or create user
  let user = await User.findOne({ where: { email } }) as User & UserAttributes;

  if (user) {
    // User exists - update Google ID if not set
    if (!user.google_id) {
      await user.update({ google_id: googleId });
    }
    // Update avatar if available
    if (avatarUrl && !user.avatar_url) {
      await user.update({ avatar_url: avatarUrl });
    }
  } else {
    // Create new user
    // Generate username from email (before @)
    const usernameBase = email.split('@')[0];
    let username = usernameBase;
    let counter = 1;

    // Ensure username is unique
    while (await User.findOne({ where: { username } })) {
      username = `${usernameBase}${counter}`;
      counter++;
    }

    user = await User.create({
      email,
      username,
      google_id: googleId,
      first_name: firstName,
      last_name: lastName,
      avatar_url: avatarUrl,
      password_hash: undefined, // Google-only account
    }) as User & UserAttributes;
  }

  return user;
};

/**
 * Generate JWT tokens
 * @param {number} userId - The user id
 * @returns {Promise<{ accessToken: string, refreshToken: string }>} The generated tokens
 */
export const generateTokens = async (userId: number) => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  
  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT secrets not configured');
  }
  
  const accessToken = jwt.sign(
    { userId },
    accessSecret,
    { expiresIn: '15m' } // Short-lived access token
  );
  
  // Generate a unique identifier for the refresh token
  const tokenId = crypto.randomUUID();
  
  const refreshToken = jwt.sign(
    { 
      userId,
      tokenId // Add unique identifier to prevent token collisions
    },
    refreshSecret,
    { expiresIn: '7d' } // 7-day refresh token
  );
  
  // Store refresh token in database
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
  
  // Delete any existing refresh token for this user
  await RefreshToken.destroy({
    where: { user_id: userId }
  });
  
  // Create new refresh token
  await RefreshToken.create({
    token: refreshToken,
    user_id: userId,
    expires_at: expiresAt,
    is_revoked: false
  });
  
  return { accessToken, refreshToken };
};

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
    
    // Find user by email
    const user = await User.findOne({ where: { email: email.toLowerCase() } }) as User & UserAttributes;
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'login_failure', {
        reason: 'user_not_found',
      });
      return;
    }
    
    // Check if user has a password (not a Google-only account)
    if (!user.password_hash) {
      res.status(401).json({ message: 'Invalid credentials. Please sign in with Google.' });
      await trackEvent(user.id.toString(), 'login_failure', {
        reason: 'no_password',
      });
      return;
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid credentials' });
      await trackEvent(user.id.toString(), 'login_failure', {
        reason: 'invalid_credentials',
      });
      return;
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user.id);
    
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
      accessToken,
      refreshToken
    });
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
    console.log('[Refresh Token] Request received:', { 
      hasRefreshToken: !!refreshToken,
      tokenLength: refreshToken?.length
    });
    
    if (!refreshToken) {
      console.log('[Refresh Token] No refresh token provided');
      res.status(400).json({ message: 'Refresh token is required' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'token_refresh_failure', {
        reason: 'missing_token',
      });
      return;
    }
    
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!refreshSecret) {
      console.error('[Refresh Token] JWT_REFRESH_SECRET is not defined');
      res.status(500).json({ message: 'Server configuration error' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'token_refresh_failure', {
        reason: 'server_error',
      });
      return;
    }
    
    // Verify refresh token
    console.log('[Refresh Token] Verifying token');
    let decoded: { userId: number };
    try {
      decoded = jwt.verify(refreshToken, refreshSecret) as { userId: number };
    } catch (jwtError) {
      console.error('[Refresh Token] JWT verification failed:', jwtError);
      res.status(403).json({ message: 'Invalid or expired refresh token' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'token_refresh_failure', {
        reason: 'invalid_token',
      });
      return;
    }
    
    console.log('[Refresh Token] Token verified:', { userId: decoded.userId });
    
    // Check if token exists and is not revoked
    console.log('[Refresh Token] Checking stored token');
    const storedToken = await RefreshToken.findOne({
      where: {
        token: refreshToken,
        is_revoked: false,
        expires_at: {
          [Op.gt]: new Date() // Token hasn't expired
        }
      }
    });
    
    if (!storedToken) {
      res.status(403).json({ message: 'Invalid or expired refresh token' });
      await trackEvent(decoded.userId.toString(), 'token_refresh_failure', {
        reason: 'expired_token',
      });
      return;
    }
    
    // Find user
    console.log('[Refresh Token] Finding user:', { userId: decoded.userId });
    const user = await User.findByPk(decoded.userId) as User & UserAttributes;
    if (!user) {
      console.log('[Refresh Token] User not found');
      res.status(401).json({ message: 'User not found' });
      await trackEvent(decoded.userId.toString(), 'token_refresh_failure', {
        reason: 'user_not_found',
      });
      return;
    }
    
    // Generate new tokens (this will automatically delete the old one)
    console.log('[Refresh Token] Generating new tokens');
    const tokens = await generateTokens(user.id);
    console.log('[Refresh Token] New tokens generated successfully');
    
    // Track successful token refresh
    await trackEvent(user.id.toString(), 'token_refresh_success', {});
    
    res.status(200).json({
      ...tokens,
      user
    });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      console.error('[Refresh Token] JWT verification failed:', err.message);
      res.status(403).json({ message: 'Invalid or expired refresh token' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'token_refresh_failure', {
        reason: 'invalid_token',
      });
      return;
    }
    const error = err as Error;
    console.error('[Refresh Token] Server error:', error);
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
    
    if (refreshToken) {
      // Delete the refresh token
      await RefreshToken.destroy({
        where: { token: refreshToken }
      });
    }
    
    // Track successful logout
    if (user) {
      await trackEvent(user.id.toString(), 'logout_success', {});
    }
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
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
    const state = crypto.randomBytes(32).toString('hex');
    
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

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback';

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('[Google OAuth] OAuth credentials not configured');
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'google_oauth_callback_failure', {
        reason: 'server_error',
      });
      res.redirect(`${FRONTEND_URL}/login?error=server_error`);
      return;
    }

    // Exchange authorization code for access token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    });

    const { access_token } = tokenResponse.data;

    // Fetch user profile from Google
    const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const googleProfile = profileResponse.data;

    // Check if user exists before creating
    const existingUser = await User.findOne({ where: { email: googleProfile.email?.toLowerCase() } });
    const isNewUser = !existingUser;

    // Find or create user using shared function
    const user = await findOrCreateGoogleUser(googleProfile);

    // Generate JWT tokens
    const { accessToken, refreshToken } = await generateTokens(user.id);

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
      `accessToken=${encodeURIComponent(accessToken)}&` +
      `refreshToken=${encodeURIComponent(refreshToken)}&` +
      `user=${encodeURIComponent(JSON.stringify(userData))}`;

    res.redirect(redirectUrl);
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
