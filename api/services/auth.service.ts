import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import { Op } from 'sequelize';
import User, { type UserAttributes } from '../db/models/User.model.ts';
import RefreshToken from '../db/models/RefreshToken.model.ts';

export interface GoogleProfile {
  id: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  name?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  user: User & UserAttributes;
  tokens: TokenPair;
}

/**
 * Find or create user from Google profile data
 * @param {GoogleProfile} googleProfile - Google profile data
 * @returns {Promise<User & UserAttributes>} The user object
 */
export const findOrCreateGoogleUser = async (googleProfile: GoogleProfile): Promise<User & UserAttributes> => {
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
 * @returns {Promise<TokenPair>} The generated tokens
 */
export const generateTokens = async (userId: number): Promise<TokenPair> => {
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
  
  console.log('[generateTokens] Generating tokens for user:', {
    userId,
    tokenId,
    expiresAt: expiresAt.toISOString()
  });
  
  // Delete any existing refresh token for this user
  const deletedCount = await RefreshToken.destroy({
    where: { user_id: userId }
  });
  
  console.log('[generateTokens] Deleted existing refresh tokens:', {
    userId,
    deletedCount
  });
  
  // Create new refresh token
  const newRefreshToken = await RefreshToken.create({
    token: refreshToken,
    user_id: userId,
    expires_at: expiresAt,
    is_revoked: false
  });
  
  console.log('[generateTokens] Created new refresh token:', {
    userId,
    tokenId: newRefreshToken.get('id'),
    expiresAt: expiresAt.toISOString(),
    refreshTokenPreview: `${refreshToken.substring(0, 20)}...`
  });
  
  return { accessToken, refreshToken };
};

/**
 * Authenticate user with email and password
 * @param {LoginCredentials} credentials - User credentials
 * @returns {Promise<LoginResult>} User and tokens
 * @throws {Error} If credentials are invalid
 */
export const authenticateUser = async (credentials: LoginCredentials): Promise<LoginResult> => {
  const { email, password } = credentials;
  
  if (!email || !password) {
    throw new Error('Email and password are required');
  }
  
  // Find user by email
  const user = await User.findOne({ where: { email: email.toLowerCase() } }) as User & UserAttributes;
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  // Check if user has a password (not a Google-only account)
  if (!user.password_hash) {
    throw new Error('Invalid credentials. Please sign in with Google.');
  }
  
  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }
  
  // Generate tokens
  const tokens = await generateTokens(user.id);
  
  return { user, tokens };
};

/**
 * Verify and validate refresh token
 * @param {string} refreshToken - The refresh token to verify
 * @returns {Promise<{ userId: number; storedToken: RefreshToken }>} User ID and stored token
 * @throws {Error} If token is invalid or expired
 */
export const verifyRefreshToken = async (refreshToken: string): Promise<{ userId: number; storedToken: RefreshToken }> => {
  if (!refreshToken) {
    throw new Error('Refresh token is required');
  }
  
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET not configured');
  }
  
  // Verify refresh token
  let decoded: { userId: number };
  try {
    decoded = jwt.verify(refreshToken, refreshSecret) as { userId: number };
    console.log('[verifyRefreshToken] JWT verification successful:', {
      userId: decoded.userId
    });
  } catch (jwtError) {
    console.error('[verifyRefreshToken] JWT verification failed:', {
      error: jwtError instanceof Error ? jwtError.message : 'Unknown error',
      errorName: jwtError instanceof Error ? jwtError.name : 'Unknown'
    });
    throw new Error('Invalid or expired refresh token');
  }
  
  // Check if token exists and is not revoked
  console.log('[verifyRefreshToken] Checking stored token in database:', {
    userId: decoded.userId,
    tokenPreview: `${refreshToken.substring(0, 20)}...`
  });
  
  const storedToken = await RefreshToken.findOne({
    where: {
      token: refreshToken,
      is_revoked: false,
      expires_at: {
        [Op.gt]: new Date() // Token hasn't expired
      }
    }
  });
  
  console.log('[verifyRefreshToken] Database lookup result:', {
    found: !!storedToken,
    userId: decoded.userId,
    tokenId: storedToken?.get('id'),
    isRevoked: storedToken?.get('is_revoked'),
    expiresAt: storedToken?.get('expires_at') ? new Date(storedToken.get('expires_at') as Date).toISOString() : 'N/A',
    now: new Date().toISOString()
  });
  
  if (!storedToken) {
    console.error('[verifyRefreshToken] Token not found or invalid in database:', {
      userId: decoded.userId,
      reason: 'Token may be revoked, expired, or not found'
    });
    throw new Error('Invalid or expired refresh token');
  }
  
  return { userId: decoded.userId, storedToken };
};

/**
 * Refresh tokens for a user
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<{ user: User & UserAttributes; tokens: TokenPair }>} User and new tokens
 * @throws {Error} If token is invalid or user not found
 */
export const refreshUserTokens = async (refreshToken: string): Promise<{ user: User & UserAttributes; tokens: TokenPair }> => {
  const { userId } = await verifyRefreshToken(refreshToken);
  
  // Find user
  const user = await User.findByPk(userId) as User & UserAttributes;
  if (!user) {
    console.error('[refreshUserTokens] User not found:', {
      userId
    });
    throw new Error('User not found');
  }
  
  console.log('[refreshUserTokens] Generating new tokens for user:', {
    userId: user.id,
    familyGroupId: user.family_group_id
  });
  
  // Generate new tokens (this will automatically delete the old one)
  const tokens = await generateTokens(user.id);
  
  console.log('[refreshUserTokens] Token refresh successful:', {
    userId: user.id,
    hasAccessToken: !!tokens.accessToken,
    hasRefreshToken: !!tokens.refreshToken
  });
  
  return { user, tokens };
};

/**
 * Revoke refresh token
 * @param {string} refreshToken - The refresh token to revoke
 * @returns {Promise<void>}
 */
export const revokeRefreshToken = async (refreshToken: string): Promise<void> => {
  if (refreshToken) {
    await RefreshToken.destroy({
      where: { token: refreshToken }
    });
  }
};

/**
 * Exchange Google authorization code for access token and fetch user profile
 * @param {string} code - Authorization code from Google
 * @returns {Promise<{ accessToken: string; profile: GoogleProfile }>} Access token and user profile
 * @throws {Error} If exchange fails
 */
export const exchangeGoogleCode = async (code: string): Promise<{ accessToken: string; profile: GoogleProfile }> => {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback';

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('OAuth credentials not configured');
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

  const profile = profileResponse.data as GoogleProfile;

  return { accessToken: access_token, profile };
};

/**
 * Verify Google ID token and extract profile
 * @param {string} idToken - Google ID token
 * @returns {Promise<GoogleProfile>} Google profile data
 * @throws {Error} If token is invalid or verification fails
 */
export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleProfile> => {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

  if (!GOOGLE_CLIENT_ID) {
    throw new Error('OAuth credentials not configured');
  }

  if (!idToken) {
    throw new Error('ID token is required');
  }

  // Verify ID token with Google
  const tokenResponse = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
    params: {
      id_token: idToken
    }
  });

  const tokenInfo = tokenResponse.data;

  // Verify the token is for our client
  if (tokenInfo.aud !== GOOGLE_CLIENT_ID) {
    console.error('[verifyGoogleIdToken] Token audience mismatch');
    throw new Error('Invalid token');
  }

  // Extract user information from token
  const googleProfile: GoogleProfile = {
    id: tokenInfo.sub,
    email: tokenInfo.email,
    given_name: tokenInfo.given_name,
    family_name: tokenInfo.family_name,
    picture: tokenInfo.picture,
    name: tokenInfo.name
  };

  if (!googleProfile.email) {
    console.error('[verifyGoogleIdToken] No email in token');
    throw new Error('No email in Google profile');
  }

  return googleProfile;
};

/**
 * Authenticate user with Google ID token
 * @param {string} idToken - Google ID token
 * @returns {Promise<{ user: User & UserAttributes; tokens: TokenPair; isNewUser: boolean }>} User, tokens, and whether user is new
 * @throws {Error} If token is invalid or authentication fails
 */
export const authenticateWithGoogleToken = async (idToken: string): Promise<{
  user: User & UserAttributes;
  tokens: TokenPair;
  isNewUser: boolean;
}> => {
  // Verify Google ID token
  const googleProfile = await verifyGoogleIdToken(idToken);

  // Check if user exists before creating
  const existingUser = await User.findOne({ where: { email: googleProfile.email?.toLowerCase() } });
  const isNewUser = !existingUser;

  // Find or create user
  const user = await findOrCreateGoogleUser(googleProfile);

  // Generate JWT tokens
  const tokens = await generateTokens(user.id);

  return { user, tokens, isNewUser };
};

/**
 * Generate OAuth state for CSRF protection
 * @returns {string} Random state string
 */
export const generateOAuthState = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

