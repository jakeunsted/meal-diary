import bcrypt from 'bcrypt';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import User, { type UserAttributes } from '../db/models/User.model.ts';
import RefreshToken from '../db/models/RefreshToken.model.ts';
import OAuthExchangeCode from '../db/models/OAuthExchangeCode.model.ts';
import { normalizeEmail } from '../utils/normalizeEmail.ts';
import { HttpError } from '../utils/httpError.ts';

const REFRESH_TOKEN_TTL_DAYS = 28;
const OAUTH_EXCHANGE_TTL_MS = 2 * 60 * 1000;

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

export interface AppleProfile {
  id: string;
  email?: string;
  givenName?: string;
  familyName?: string;
}

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_KEYS_TTL_MS = 60 * 60 * 1000;

interface AppleJwk extends crypto.JsonWebKey {
  kid: string;
}

let cachedAppleKeys: { keys: AppleJwk[]; fetchedAt: number } | null = null;

/** Drop the cached Apple signing keys. Used by tests. */
export const clearApplePublicKeyCache = (): void => {
  cachedAppleKeys = null;
};

const socialOnlyLoginMessage = (user: UserAttributes): string => {
  const hasApple = Boolean(user.apple_id);
  const hasGoogle = Boolean(user.google_id);

  if (hasApple && hasGoogle) {
    return 'Invalid credentials. Please sign in with Apple or Google.';
  }

  if (hasApple) {
    return 'Invalid credentials. Please sign in with Apple.';
  }

  return 'Invalid credentials. Please sign in with Google.';
};

const optionalName = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, 50);
};

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
    const updates: Partial<UserAttributes> = {};
    if (!user.google_id) {
      updates.google_id = googleId;
    }
    // Update avatar if available
    if (avatarUrl && !user.avatar_url) {
      updates.avatar_url = avatarUrl;
    }
    if (!user.normalized_email) {
      updates.normalized_email = normalizeEmail(email);
    }
    if (Object.keys(updates).length > 0) {
      await user.update(updates);
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
      normalized_email: normalizeEmail(email),
      username,
      google_id: googleId,
      first_name: firstName,
      last_name: lastName,
      avatar_url: avatarUrl,
      password_hash: undefined, // Google-only account
      // OAuth sign-up: the login screen states that continuing with Google
      // constitutes acceptance of the terms and privacy policy
      terms_accepted_at: new Date(),
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
    { expiresIn: '10m' } // Short-lived access token
  );
  
  // Generate a unique identifier for the refresh token
  const tokenId = crypto.randomUUID();
  
  const refreshToken = jwt.sign(
    { 
      userId,
      tokenId // Add unique identifier to prevent token collisions
    },
    refreshSecret,
    { expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d` }
  );
  
  // Store refresh token in database (multi-session: do not delete other sessions)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

  await RefreshToken.create({
    token: refreshToken,
    user_id: userId,
    expires_at: expiresAt,
    is_revoked: false
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
  
  // Passwordless accounts must use the provider that created them
  if (!user.password_hash) {
    throw new Error(socialOnlyLoginMessage(user));
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
export const verifyRefreshToken = async (
  refreshToken: string
): Promise<{ userId: number; storedToken: RefreshToken }> => {
  if (!refreshToken) {
    throw new Error('Refresh token is required');
  }
  
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET not configured');
  }
  
  // Verify refresh token
  let decoded: { userId: number; tokenId?: string };
  try {
    decoded = jwt.verify(refreshToken, refreshSecret) as { userId: number; tokenId?: string };
  } catch {
    throw new Error('Invalid or expired refresh token');
  }
  
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
export const refreshUserTokens = async (
  refreshToken: string
): Promise<{ user: User & UserAttributes; tokens: TokenPair }> => {
  const { userId } = await verifyRefreshToken(refreshToken);
  
  // Find user
  const user = await User.findByPk(userId) as User & UserAttributes;
  if (!user) {
    throw new Error('User not found');
  }
  
  // Rotate only this session's refresh token; leave other sessions intact
  const tokens = await generateTokens(user.id);
  await RefreshToken.destroy({
    where: { token: refreshToken }
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
 * Create a short-lived one-time code for completing a web OAuth login on the frontend.
 * Avoids putting JWTs in redirect query strings (history, Referer, proxy logs).
 */
export const createOAuthExchangeCode = async (userId: number): Promise<string> => {
  const rawCode = crypto.randomBytes(32).toString('hex');
  const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
  const expiresAt = new Date(Date.now() + OAUTH_EXCHANGE_TTL_MS);

  await OAuthExchangeCode.create({
    user_id: userId,
    code_hash: codeHash,
    expires_at: expiresAt,
    used_at: null,
  });

  return rawCode;
};

/**
 * Consume an OAuth exchange code and issue session tokens.
 */
export const exchangeOAuthCode = async (
  rawCode: string
): Promise<{ user: User & UserAttributes; tokens: TokenPair }> => {
  if (!rawCode) {
    throw new Error('Exchange code is required');
  }

  const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
  const row = await OAuthExchangeCode.findOne({
    where: {
      code_hash: codeHash,
      used_at: null,
      expires_at: { [Op.gt]: new Date() },
    },
  });

  if (!row) {
    throw new Error('Invalid or expired exchange code');
  }

  row.used_at = new Date();
  await row.save();

  const user = await User.findByPk(row.user_id) as User & UserAttributes | null;
  if (!user) {
    throw new Error('User not found');
  }

  const tokens = await generateTokens(user.id);
  return { user, tokens };
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
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json().catch(() => undefined);
    throw new HttpError(
      `Google token exchange failed with status ${tokenResponse.status}`,
      tokenResponse.status,
      errorData
    );
  }

  const { access_token } = await tokenResponse.json();

  // Fetch user profile from Google
  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  if (!profileResponse.ok) {
    const errorData = await profileResponse.json().catch(() => undefined);
    throw new HttpError(
      `Google profile fetch failed with status ${profileResponse.status}`,
      profileResponse.status,
      errorData
    );
  }

  const profile = await profileResponse.json() as GoogleProfile;

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
  const tokenInfoUrl = new URL('https://oauth2.googleapis.com/tokeninfo');
  tokenInfoUrl.searchParams.set('id_token', idToken);
  const tokenResponse = await fetch(tokenInfoUrl);

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json().catch(() => undefined);
    throw new HttpError(
      `Google ID token verification failed with status ${tokenResponse.status}`,
      tokenResponse.status,
      errorData
    );
  }

  const tokenInfo = await tokenResponse.json();

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

const sha256Hex = (value: string): string => {
  return crypto.createHash('sha256').update(value).digest('hex');
};

const nonceMatches = (tokenNonce: unknown, rawNonce: string): boolean => {
  if (typeof tokenNonce !== 'string' || !rawNonce) {
    return false;
  }

  const expected = sha256Hex(rawNonce);
  if (expected.length !== tokenNonce.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(tokenNonce));
};

const fetchAppleKeys = async (): Promise<AppleJwk[]> => {
  const response = await fetch(APPLE_KEYS_URL);
  if (!response.ok) {
    throw new Error('Unable to verify Apple identity token');
  }

  const body = await response.json() as { keys?: AppleJwk[] };
  if (!body.keys?.length) {
    throw new Error('Unable to verify Apple identity token');
  }

  return body.keys;
};

const getAppleSigningKey = async (kid: string): Promise<crypto.KeyObject> => {
  const loadKeys = async (force: boolean): Promise<AppleJwk | undefined> => {
    const now = Date.now();
    if (force || !cachedAppleKeys || now - cachedAppleKeys.fetchedAt > APPLE_KEYS_TTL_MS) {
      const keys = await fetchAppleKeys();
      cachedAppleKeys = { keys, fetchedAt: Date.now() };
    }

    return cachedAppleKeys.keys.find((key) => key.kid === kid);
  };

  let jwk = await loadKeys(false);
  if (!jwk) {
    jwk = await loadKeys(true);
  }

  if (!jwk) {
    throw new Error('Invalid token');
  }

  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
};

/**
 * Verify an Apple identity token from native Sign in with Apple.
 * The nonce claim must be the SHA-256 hex digest of the raw nonce the client sends.
 * @param {string} idToken - Apple identity token
 * @param {string} rawNonce - Raw nonce generated by the client
 * @returns {Promise<AppleProfile>} Verified Apple subject and email
 */
const appleAudiences = (): string[] => {
  return [process.env.APPLE_BUNDLE_ID, process.env.APPLE_SERVICES_ID]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
};

export const verifyAppleIdToken = async (idToken: string, rawNonce: string): Promise<AppleProfile> => {
  const audiences = appleAudiences();

  if (audiences.length === 0) {
    throw new Error('OAuth credentials not configured');
  }

  if (!idToken) {
    throw new Error('ID token is required');
  }

  if (!rawNonce) {
    throw new Error('Nonce is required');
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw new Error('Invalid token');
  }

  const publicKey = await getAppleSigningKey(decoded.header.kid);

  let verified: JwtPayload;
  try {
    verified = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      issuer: APPLE_ISSUER,
      audience: audiences as [string, ...string[]],
    }) as JwtPayload;
  } catch {
    throw new Error('Invalid token');
  }

  if (!nonceMatches(verified.nonce, rawNonce)) {
    throw new Error('Invalid nonce');
  }

  if (typeof verified.sub !== 'string' || !verified.sub) {
    throw new Error('Invalid token');
  }

  const email = typeof verified.email === 'string' ? verified.email : undefined;
  if (email) {
    const emailVerified = verified.email_verified;
    if (emailVerified !== true && emailVerified !== 'true') {
      throw new Error('Invalid token');
    }
  }

  return {
    id: verified.sub,
    email,
  };
};

/**
 * Find or create a user from a verified Apple identity.
 * Returning users are matched on apple_id first, because Apple omits email after the first grant.
 * @param {AppleProfile} appleProfile - Verified Apple profile, plus optional name from the client
 * @returns {Promise<User & UserAttributes>} The user object
 */
export const findOrCreateAppleUser = async (appleProfile: AppleProfile): Promise<User & UserAttributes> => {
  const appleId = appleProfile.id;
  const email = appleProfile.email?.toLowerCase();
  const givenName = optionalName(appleProfile.givenName);
  const familyName = optionalName(appleProfile.familyName);

  let user = await User.findOne({ where: { apple_id: appleId } }) as (User & UserAttributes) | null;

  if (!user && email) {
    user = await User.findOne({ where: { email } }) as (User & UserAttributes) | null;
  }

  if (user) {
    const updates: Partial<UserAttributes> = {};
    if (!user.apple_id) {
      updates.apple_id = appleId;
    }
    if (givenName && !user.first_name) {
      updates.first_name = givenName;
    }
    if (familyName && !user.last_name) {
      updates.last_name = familyName;
    }
    if (!user.normalized_email && (user.email || email)) {
      updates.normalized_email = normalizeEmail(user.email || email || '');
    }
    if (Object.keys(updates).length > 0) {
      await user.update(updates);
    }
    return user;
  }

  if (!email) {
    throw new Error('No email in Apple profile');
  }

  const usernameBase = email.split('@')[0];
  let username = usernameBase;
  let counter = 1;

  while (await User.findOne({ where: { username } })) {
    username = `${usernameBase}${counter}`;
    counter++;
  }

  user = await User.create({
    email,
    normalized_email: normalizeEmail(email),
    username,
    apple_id: appleId,
    first_name: givenName,
    last_name: familyName,
    password_hash: undefined,
    // OAuth sign-up: the login screen states that continuing constitutes
    // acceptance of the terms and privacy policy
    terms_accepted_at: new Date(),
  }) as User & UserAttributes;

  return user;
};

/**
 * Authenticate a user with a native Sign in with Apple identity token.
 * @param {string} idToken - Apple identity token
 * @param {string} rawNonce - Raw nonce whose SHA-256 was sent to Apple
 * @param {{ givenName?: string; familyName?: string }} name - Name from the first Apple authorization
 * @returns {Promise<{ user: User & UserAttributes; tokens: TokenPair; isNewUser: boolean }>} User, tokens, and whether the user is new
 */
export const authenticateWithAppleToken = async (
  idToken: string,
  rawNonce: string,
  name: { givenName?: string; familyName?: string } = {}
): Promise<{
  user: User & UserAttributes;
  tokens: TokenPair;
  isNewUser: boolean;
}> => {
  const appleProfile = await verifyAppleIdToken(idToken, rawNonce);
  appleProfile.givenName = optionalName(name.givenName);
  appleProfile.familyName = optionalName(name.familyName);

  const email = appleProfile.email?.toLowerCase();
  const existingByAppleId = await User.findOne({ where: { apple_id: appleProfile.id } });
  const existingByEmail = !existingByAppleId && email
    ? await User.findOne({ where: { email } })
    : null;
  const isNewUser = !existingByAppleId && !existingByEmail;

  const user = await findOrCreateAppleUser(appleProfile);
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

