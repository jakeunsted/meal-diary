import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { isPasswordValid, isValidEmail } from '@meal-diary/shared';
import User, { type UserAttributes } from '../db/models/User.model.ts';
import PasswordResetToken from '../db/models/PasswordResetToken.model.ts';
import RefreshToken from '../db/models/RefreshToken.model.ts';
import { sendMail, type MailMessage } from './mail.service.ts';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const PASSWORD_SALT_ROUNDS = 10;

export const INVALID_RESET_LINK_MESSAGE = 'Reset link is invalid or has expired';
export const PASSWORD_REQUIREMENTS_MESSAGE = 'Password does not meet requirements';

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const frontendBaseUrl = (): string => {
  const configured = process.env.FRONTEND_URL || 'http://localhost:3000';
  return configured.replace(/\/$/, '');
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const sendMailSafely = async (message: MailMessage): Promise<void> => {
  try {
    await sendMail(message);
  } catch (error) {
    console.error('[password-reset] Failed to send email', error);
  }
};

const googleSignInMessage = (): MailMessage => {
  const text = [
    'This Meal Diary account signs in with Google, so there is no password to reset.',
    '',
    'Use Sign in with Google on the login page.',
    '',
    "If you didn't ask for this, you can ignore this email.",
  ].join('\n');

  return {
    to: '',
    subject: 'Sign in to Meal Diary',
    text,
    html: `<p>This Meal Diary account signs in with Google, so there is no password to reset.</p><p>Use Sign in with Google on the login page.</p><p>If you didn't ask for this, you can ignore this email.</p>`,
  };
};

const resetLinkMessage = (resetUrl: string): Omit<MailMessage, 'to'> => {
  const text = [
    'You asked to reset your Meal Diary password.',
    '',
    'Open this link within the next hour:',
    resetUrl,
    '',
    "If you didn't ask for this, you can ignore this email.",
  ].join('\n');

  const safeUrl = escapeHtml(resetUrl);

  return {
    subject: 'Reset your Meal Diary password',
    text,
    html: `<p>You asked to reset your Meal Diary password.</p><p><a href="${safeUrl}">Reset your password</a></p><p>This link expires in one hour. If you didn't ask for this, you can ignore this email.</p>`,
  };
};

const resetUrlFor = (rawToken: string): string => {
  const url = new URL(`${frontendBaseUrl()}/reset-password`);
  url.searchParams.set('token', rawToken);
  return url.toString();
};

/**
 * Email reset instructions when the address belongs to an account.
 * Unknown addresses are ignored so callers can return a generic response.
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    return;
  }

  const user = await User.findOne({ where: { email: normalizedEmail } }) as (User & UserAttributes) | null;
  if (!user) {
    return;
  }

  if (!user.password_hash) {
    await sendMailSafely({
      ...googleSignInMessage(),
      to: user.email,
    });
    return;
  }

  await PasswordResetToken.destroy({
    where: {
      user_id: user.id,
      used_at: null,
    },
  });

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await PasswordResetToken.create({
    user_id: user.id,
    token_hash: hashToken(rawToken),
    expires_at: expiresAt,
  });

  const resetUrl = resetUrlFor(rawToken);
  await sendMailSafely({
    to: user.email,
    ...resetLinkMessage(resetUrl),
  });
};

/**
 * Replace the account password for a valid, unused reset token and end other sessions.
 */
export const completePasswordReset = async (token: string, password: string): Promise<void> => {
  if (!token) {
    throw new Error(INVALID_RESET_LINK_MESSAGE);
  }

  if (!isPasswordValid(password)) {
    throw new Error(PASSWORD_REQUIREMENTS_MESSAGE);
  }

  const record = await PasswordResetToken.findOne({
    where: {
      token_hash: hashToken(token),
      used_at: null,
      expires_at: {
        [Op.gt]: new Date(),
      },
    },
  });

  if (!record) {
    throw new Error(INVALID_RESET_LINK_MESSAGE);
  }

  const user = await User.findByPk(record.user_id) as (User & UserAttributes) | null;
  if (!user) {
    throw new Error(INVALID_RESET_LINK_MESSAGE);
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  await user.update({ password_hash: passwordHash });
  await record.update({ used_at: new Date() });
  await PasswordResetToken.destroy({
    where: {
      user_id: user.id,
      used_at: null,
    },
  });
  await RefreshToken.destroy({
    where: { user_id: user.id },
  });
};
