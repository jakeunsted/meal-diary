import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

const { sendMailMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(async () => 'hashed-password'),
  },
}));

vi.mock('../../db/models/User.model.ts', () => ({
  default: {
    findOne: vi.fn(),
    findByPk: vi.fn(),
  },
}));

vi.mock('../../db/models/PasswordResetToken.model.ts', () => ({
  default: {
    destroy: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('../../db/models/RefreshToken.model.ts', () => ({
  default: {
    destroy: vi.fn(),
  },
}));

vi.mock('../mail.service.ts', () => ({
  sendMail: sendMailMock,
}));

import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import User from '../../db/models/User.model.ts';
import PasswordResetToken from '../../db/models/PasswordResetToken.model.ts';
import RefreshToken from '../../db/models/RefreshToken.model.ts';
import {
  completePasswordReset,
  INVALID_RESET_LINK_MESSAGE,
  PASSWORD_REQUIREMENTS_MESSAGE,
  requestPasswordReset,
} from '../passwordReset.service.ts';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FRONTEND_URL = 'http://localhost:3000';
});

describe('requestPasswordReset', () => {
  it('does nothing when the email is unknown', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null);

    await requestPasswordReset('missing@example.com');

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(PasswordResetToken.create).not.toHaveBeenCalled();
  });

  it('does nothing when the email is invalid', async () => {
    await requestPasswordReset('not-an-email');

    expect(User.findOne).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('stores a hashed token and emails the reset link for password accounts', async () => {
    vi.mocked(User.findOne).mockResolvedValue({
      id: 4,
      email: 'user@example.com',
      password_hash: 'existing-hash',
    } as never);
    vi.mocked(PasswordResetToken.destroy).mockResolvedValue(1 as never);
    vi.mocked(PasswordResetToken.create).mockResolvedValue({} as never);

    await requestPasswordReset('user@example.com');

    expect(PasswordResetToken.destroy).toHaveBeenCalledWith({
      where: { user_id: 4, used_at: null },
    });

    const message = sendMailMock.mock.calls[0][0] as { to: string; text: string; subject: string };
    expect(message.to).toBe('user@example.com');
    expect(message.subject).toBe('Reset your Meal Diary password');
    expect(message.text).toContain('http://localhost:3000/reset-password?token=');
    expect(message.text).not.toContain('client=app');

    const tokenMatch = message.text.match(/token=(\S+)/);
    expect(tokenMatch).toBeTruthy();
    const rawToken = decodeURIComponent(tokenMatch![1]);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    expect(PasswordResetToken.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 4,
      token_hash: tokenHash,
    }));
  });

  it('emails Google-only accounts without a reset link or token', async () => {
    vi.mocked(User.findOne).mockResolvedValue({
      id: 5,
      email: 'google@example.com',
      password_hash: null,
    } as never);

    await requestPasswordReset('google@example.com');

    expect(PasswordResetToken.create).not.toHaveBeenCalled();
    const message = sendMailMock.mock.calls[0][0] as { text: string; subject: string };
    expect(message.subject).toBe('Sign in to Meal Diary');
    expect(message.text.toLowerCase()).toContain('google');
    expect(message.text).not.toContain('reset-password');
  });
});

describe('completePasswordReset', () => {
  it('updates the password, marks the token used, and revokes refresh tokens', async () => {
    const record = {
      user_id: 8,
      update: vi.fn(),
    };
    const user = {
      id: 8,
      update: vi.fn(),
    };
    vi.mocked(PasswordResetToken.findOne).mockResolvedValue(record as never);
    vi.mocked(User.findByPk).mockResolvedValue(user as never);
    vi.mocked(PasswordResetToken.destroy).mockResolvedValue(1 as never);
    vi.mocked(RefreshToken.destroy).mockResolvedValue(2 as never);

    await completePasswordReset('raw-token', 'NewPassword1!');

    expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword1!', 10);
    expect(user.update).toHaveBeenCalledWith({ password_hash: 'hashed-password' });
    expect(record.update).toHaveBeenCalledWith({ used_at: expect.any(Date) });
    expect(PasswordResetToken.destroy).toHaveBeenCalledWith({
      where: { user_id: 8, used_at: null },
    });
    expect(RefreshToken.destroy).toHaveBeenCalledWith({
      where: { user_id: 8 },
    });

    const where = vi.mocked(PasswordResetToken.findOne).mock.calls[0][0]?.where as {
      used_at: null;
      token_hash: string;
      expires_at: Record<symbol, Date>;
    };
    expect(where.used_at).toBeNull();
    expect(where.token_hash).toBe(crypto.createHash('sha256').update('raw-token').digest('hex'));
    expect(where.expires_at[Op.gt]).toBeInstanceOf(Date);
  });

  it('rejects an unknown, used, or expired token', async () => {
    vi.mocked(PasswordResetToken.findOne).mockResolvedValue(null);

    await expect(completePasswordReset('expired-token', 'NewPassword1!')).rejects.toThrow(
      INVALID_RESET_LINK_MESSAGE
    );
    expect(User.findByPk).not.toHaveBeenCalled();
    expect(RefreshToken.destroy).not.toHaveBeenCalled();
  });

  it('rejects a password that does not meet requirements', async () => {
    await expect(completePasswordReset('raw-token', 'password')).rejects.toThrow(
      PASSWORD_REQUIREMENTS_MESSAGE
    );
    expect(PasswordResetToken.findOne).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });
});
