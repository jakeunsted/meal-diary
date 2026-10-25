import crypto from 'crypto';
import { Op } from 'sequelize';
import { isValidEmail } from '@meal-diary/shared';
import User, { type UserAttributes } from '../db/models/User.model.ts';
import EmailChangeToken from '../db/models/EmailChangeToken.model.ts';
import { sendMail } from './mail.service.ts';
import { normalizeEmail } from '../utils/normalizeEmail.ts';
import { sanitizeUser, type SanitizedUser } from './user.service.ts';

const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000;

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const emailTaken = async (userId: number, email: string): Promise<boolean> => {
  const normalized = normalizeEmail(email);
  const existing = await User.findOne({
    where: {
      id: { [Op.ne]: userId },
      [Op.or]: [
        { email: email.toLowerCase() },
        { normalized_email: normalized },
      ],
    },
  });
  return !!existing;
};

export const requestEmailChange = async (userId: number, email: string): Promise<void> => {
  if (!email || !isValidEmail(email)) {
    throw new Error('A valid email address is required');
  }

  const user = await User.findByPk(userId) as (User & UserAttributes) | null;
  if (!user) {
    throw new Error('User not found');
  }

  const pendingEmail = email.trim().toLowerCase();
  if (pendingEmail === user.email.toLowerCase()) {
    throw new Error('That is already your email address');
  }

  if (await emailTaken(userId, pendingEmail)) {
    throw new Error('Email already in use');
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  await EmailChangeToken.destroy({
    where: {
      user_id: userId,
      used_at: null,
    },
  });

  const token = await EmailChangeToken.create({
    user_id: userId,
    pending_email: pendingEmail,
    token_hash: hashToken(code),
    expires_at: new Date(Date.now() + EMAIL_CHANGE_TTL_MS),
  });

  const text = [
    `Confirm ${pendingEmail} as your Meal Diary email address.`,
    '',
    `Your confirmation code is ${code}.`,
    '',
    'It expires in one hour. If you did not ask for this, you can ignore this email.',
  ].join('\n');

  try {
    await sendMail({
      to: pendingEmail,
      subject: 'Confirm your Meal Diary email',
      text,
      html: `<p>Confirm ${escapeHtml(pendingEmail)} as your Meal Diary email address.</p><p>Your confirmation code is <strong>${code}</strong>.</p><p>It expires in one hour. If you did not ask for this, you can ignore this email.</p>`,
    });
  } catch (error) {
    await token.destroy();
    console.error('[email-change] Failed to send confirmation email', error);
    throw new Error('Failed to send confirmation email');
  }
};

export const confirmEmailChange = async (userId: number, code: string): Promise<SanitizedUser> => {
  if (!code || !/^\d{6}$/.test(code)) {
    throw new Error('Confirmation code is invalid or has expired');
  }

  const user = await User.findByPk(userId) as (User & UserAttributes) | null;
  if (!user) {
    throw new Error('User not found');
  }

  const token = await EmailChangeToken.findOne({
    where: {
      user_id: userId,
      token_hash: hashToken(code),
      used_at: null,
      expires_at: { [Op.gt]: new Date() },
    },
  });

  if (!token) {
    throw new Error('Confirmation code is invalid or has expired');
  }

  if (await emailTaken(userId, token.pending_email)) {
    throw new Error('Email already in use');
  }

  await user.update({
    email: token.pending_email,
    normalized_email: normalizeEmail(token.pending_email),
  });
  await token.update({ used_at: new Date() });

  const updatedUser = await User.findByPk(userId) as User & UserAttributes;
  return sanitizeUser(updatedUser);
};
