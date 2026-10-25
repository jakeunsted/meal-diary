import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMailMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
}));

vi.mock('../../db/models/User.model.ts', () => ({
  default: {
    findOne: vi.fn(),
    findByPk: vi.fn(),
  },
}));

vi.mock('../../db/models/EmailChangeToken.model.ts', () => ({
  default: {
    destroy: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('../mail.service.ts', () => ({
  sendMail: sendMailMock,
}));

vi.mock('../user.service.ts', () => ({
  sanitizeUser: (user: { toJSON: () => Record<string, unknown> }) => {
    const json = { ...user.toJSON() };
    delete json.password_hash;
    return json;
  },
}));

import User from '../../db/models/User.model.ts';
import EmailChangeToken from '../../db/models/EmailChangeToken.model.ts';
import { confirmEmailChange, requestEmailChange } from '../emailChange.service.ts';

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

beforeEach(() => {
  vi.clearAllMocks();
  sendMailMock.mockResolvedValue(undefined);
});

describe('requestEmailChange', () => {
  it('stores a hash of the code and does not change the email yet', async () => {
    const update = vi.fn();
    vi.mocked(User.findByPk).mockResolvedValue({
      id: 4,
      email: 'ada@example.com',
      update,
    } as never);
    vi.mocked(User.findOne).mockResolvedValue(null);
    vi.mocked(EmailChangeToken.create).mockResolvedValue({ destroy: vi.fn() } as never);

    await requestEmailChange(4, 'New@Example.com');

    const mailed = sendMailMock.mock.calls[0][0] as { to: string; text: string };
    expect(mailed.to).toBe('new@example.com');
    const code = mailed.text.match(/\d{6}/)?.[0];
    expect(code).toEqual(expect.any(String));
    expect(EmailChangeToken.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 4,
      pending_email: 'new@example.com',
      token_hash: hashToken(code as string),
    }));
    expect(update).not.toHaveBeenCalled();
    const stored = vi.mocked(EmailChangeToken.create).mock.calls[0][0] as { token_hash: string };
    expect(stored.token_hash).not.toBe(code);
  });

  it('rejects an address that is already in use', async () => {
    vi.mocked(User.findByPk).mockResolvedValue({
      id: 4,
      email: 'ada@example.com',
    } as never);
    vi.mocked(User.findOne).mockResolvedValue({ id: 8 } as never);

    await expect(requestEmailChange(4, 'taken@example.com')).rejects.toThrow('Email already in use');
    expect(EmailChangeToken.create).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

describe('confirmEmailChange', () => {
  it('applies the pending email only after the code matches', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const user = {
      id: 4,
      email: 'ada@example.com',
      update,
      toJSON() {
        return { id: 4, email: 'new@example.com', username: 'ada' };
      },
    };
    const token = {
      pending_email: 'new@example.com',
      update: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(User.findByPk).mockResolvedValue(user as never);
    vi.mocked(User.findOne).mockResolvedValue(null);
    vi.mocked(EmailChangeToken.findOne).mockResolvedValue(token as never);

    const result = await confirmEmailChange(4, '123456');

    expect(EmailChangeToken.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        user_id: 4,
        token_hash: hashToken('123456'),
      }),
    }));
    expect(update).toHaveBeenCalledWith({
      email: 'new@example.com',
      normalized_email: 'new@example.com',
    });
    expect(token.update).toHaveBeenCalledWith(expect.objectContaining({
      used_at: expect.any(Date),
    }));
    expect(result).toMatchObject({ id: 4, email: 'new@example.com' });
    expect(result).not.toHaveProperty('password_hash');
  });
});
