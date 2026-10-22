import type { Request, Response } from 'express';
import * as AuthService from '../../services/auth.service.ts';
import { trackEvent, sanitizeErrorForAnalytics } from '../../utils/posthog.ts';
import { trackAuthLog } from '../../utils/otelLogs.ts';
import { INTERNAL_SERVER_ERROR_MESSAGE, isInfrastructureError } from '../../utils/clientError.ts';

const optionalName = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/**
 * Verify an Apple identity token and authenticate the user
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {Promise<void>}
 */
export const verifyAppleToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, nonce, givenName, familyName } = req.body ?? {};

    if (!idToken || !nonce) {
      res.status(400).json({ message: 'ID token and nonce are required' });
      await trackAuthLog(req, 'apple_token_verification_failure', {
        reason: 'missing_token',
        error_type: 'missing_token',
        error_message: 'ID token and nonce are required',
        flow: 'native_apple_token',
      });
      return;
    }

    try {
      const { user, tokens, isNewUser } = await AuthService.authenticateWithAppleToken(
        idToken,
        nonce,
        {
          givenName: optionalName(givenName),
          familyName: optionalName(familyName),
        }
      );

      await trackEvent(user.id.toString(), 'apple_token_verification_success', {
        is_new_user: isNewUser,
      });

      await trackEvent(user.id.toString(), 'login_success', {
        auth_method: 'apple',
      });

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

      res.status(200).json({
        user: userData,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });
    } catch (serviceError) {
      if (isInfrastructureError(serviceError)) {
        res.status(500).json({ message: INTERNAL_SERVER_ERROR_MESSAGE });
        return;
      }

      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Token verification failed';

      let reason = 'server_error';
      let statusCode = 500;

      if (errorMessage.includes('required')) {
        reason = 'missing_token';
        statusCode = 400;
      } else if (errorMessage.includes('not configured')) {
        reason = 'server_error';
        statusCode = 500;
      } else if (errorMessage.includes('Invalid token') || errorMessage.includes('Invalid nonce') || errorMessage.includes('invalid')) {
        reason = 'invalid_token';
        statusCode = 401;
      } else if (errorMessage.includes('No email')) {
        reason = 'no_email';
        statusCode = 400;
      }

      console.error('[Apple Token Verification] Service error:', {
        error: errorMessage,
        reason,
        statusCode
      });

      res.status(statusCode).json({ message: errorMessage });

      const { error_message, error_type } = sanitizeErrorForAnalytics(serviceError);
      await trackAuthLog(req, 'apple_token_verification_failure', {
        reason,
        error_type: reason === 'no_email' ? 'no_email' : error_type,
        error_message,
        flow: 'native_apple_token',
      });
    }
  } catch (error) {
    console.error('[Apple Token Verification] Unexpected error:', error);
    res.status(500).json({ message: 'Server error during token verification' });
    const { error_message, error_type } = sanitizeErrorForAnalytics(error);
    await trackAuthLog(req, 'apple_token_verification_failure', {
      reason: 'server_error',
      error_type,
      error_message,
      flow: 'native_apple_token',
    });
  }
};
