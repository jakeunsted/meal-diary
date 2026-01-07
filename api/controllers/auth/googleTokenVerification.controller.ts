import type { Request, Response } from 'express';
import axios from 'axios';
import { generateTokens, findOrCreateGoogleUser } from './auth.controller.ts';
import { trackEvent, getDistinctId } from '../../utils/posthog.ts';
import User from '../../db/models/User.model.ts';

/**
 * Verify Google ID token and authenticate user
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {Promise<void>}
 */
export const verifyGoogleToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ message: 'ID token is required' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'google_token_verification_failure', {
        reason: 'missing_token',
      });
      return;
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

    if (!GOOGLE_CLIENT_ID) {
      console.error('[Google Token Verification] OAuth credentials not configured');
      res.status(500).json({ message: 'Server configuration error' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'google_token_verification_failure', {
        reason: 'server_error',
      });
      return;
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
      console.error('[Google Token Verification] Token audience mismatch');
      res.status(401).json({ message: 'Invalid token' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'google_token_verification_failure', {
        reason: 'invalid_token',
      });
      return;
    }

    // Extract user information from token
    const googleProfile = {
      id: tokenInfo.sub,
      email: tokenInfo.email,
      given_name: tokenInfo.given_name,
      family_name: tokenInfo.family_name,
      picture: tokenInfo.picture,
      name: tokenInfo.name
    };

    if (!googleProfile.email) {
      console.error('[Google Token Verification] No email in token');
      res.status(400).json({ message: 'No email in Google profile' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'google_token_verification_failure', {
        reason: 'no_email',
      });
      return;
    }

    // Check if user exists before creating
    const existingUser = await User.findOne({ where: { email: googleProfile.email.toLowerCase() } });
    const isNewUser = !existingUser;

    // Find or create user
    const user = await findOrCreateGoogleUser(googleProfile);

    // Generate JWT tokens
    const { accessToken, refreshToken } = await generateTokens(user.id);

    // Track successful Google token verification
    await trackEvent(user.id.toString(), 'google_token_verification_success', {
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
    console.log('[Google Token Verification] User authenticated:', {
      id: user.id,
      email: user.email,
      username: user.username,
      family_group_id: user.family_group_id,
      hasFamilyGroup: !!user.family_group_id
    });

    // Return tokens and user data
    res.status(200).json({
      user: userData,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('[Google Token Verification] Error:', error);
    const errorObj = error as { response?: { status: number; data?: any }; message?: string };
    
    if (errorObj.response?.status === 400) {
      res.status(400).json({ message: 'Invalid ID token' });
      const distinctId = getDistinctId(req);
      await trackEvent(distinctId, 'google_token_verification_failure', {
        reason: 'invalid_token',
      });
      return;
    }
    
    res.status(500).json({ message: 'Server error during token verification' });
    const distinctId = getDistinctId(req);
    await trackEvent(distinctId, 'google_token_verification_failure', {
      reason: 'server_error',
    });
  }
};
