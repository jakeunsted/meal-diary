import type { Request, Response } from 'express';
import * as AuthService from '../../services/auth.service.ts';
import { trackEvent, sanitizeErrorForAnalytics } from '../../utils/posthog.ts';
import { trackAuthLog } from '../../utils/otelLogs.ts';

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
      await trackAuthLog(req, 'google_token_verification_failure', {
        reason: 'missing_token',
        error_type: 'missing_token',
        error_message: 'ID token is required',
        flow: 'native_google_token',
      });
      return;
    }

    try {
      const { user, tokens, isNewUser } = await AuthService.authenticateWithGoogleToken(idToken);

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
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Token verification failed';
      
      // Determine failure reason and status code
      let reason = 'server_error';
      let statusCode = 500;
      
      if (errorMessage.includes('required')) {
        reason = 'missing_token';
        statusCode = 400;
      } else if (errorMessage.includes('not configured')) {
        reason = 'server_error';
        statusCode = 500;
      } else if (errorMessage.includes('Invalid token') || errorMessage.includes('invalid')) {
        reason = 'invalid_token';
        statusCode = 401;
      } else if (errorMessage.includes('No email')) {
        reason = 'no_email';
        statusCode = 400;
      }

      console.error('[Google Token Verification] Service error:', {
        error: errorMessage,
        reason,
        statusCode
      });

      res.status(statusCode).json({ message: errorMessage });
      
      const { error_message, error_type } = sanitizeErrorForAnalytics(serviceError);
      await trackAuthLog(req, 'google_token_verification_failure', {
        reason,
        error_type: reason === 'no_email' ? 'no_email' : error_type,
        error_message,
        flow: 'native_google_token',
      });
    }
  } catch (error) {
    console.error('[Google Token Verification] Unexpected error:', error);
    const errorObj = error as { response?: { status: number; data?: any }; message?: string };
    
    if (errorObj.response?.status === 400) {
      res.status(400).json({ message: 'Invalid ID token' });
      await trackAuthLog(req, 'google_token_verification_failure', {
        reason: 'invalid_token',
        error_type: 'invalid_token',
        error_message: 'Invalid ID token',
        flow: 'native_google_token',
      });
      return;
    }
    
    res.status(500).json({ message: 'Server error during token verification' });
    const { error_message, error_type } = sanitizeErrorForAnalytics(error);
    await trackAuthLog(req, 'google_token_verification_failure', {
      reason: 'server_error',
      error_type,
      error_message,
      flow: 'native_google_token',
    });
  }
};
