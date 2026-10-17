import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

process.env.JWT_ACCESS_SECRET = 'unit-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret';

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

vi.mock('../../db/models/User.model.ts', () => ({
  default: {
    findByPk: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('../../db/models/RefreshToken.model.ts', () => ({
  default: {
    create: vi.fn(),
    destroy: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('../../db/models/OAuthExchangeCode.model.ts', () => ({
  default: {
    create: vi.fn(),
    findOne: vi.fn(),
  },
}));

import User from '../../db/models/User.model.ts';
import RefreshToken from '../../db/models/RefreshToken.model.ts';
import {
  generateTokens,
  refreshUserTokens,
  revokeRefreshToken,
} from '../auth.service.ts';

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateTokens (multi-session)', () => {
  it('stores a hash of the refresh token without deleting existing sessions', async () => {
    vi.mocked(RefreshToken.create).mockResolvedValue({} as never);

    const tokens = await generateTokens(42);

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(RefreshToken.destroy).not.toHaveBeenCalled();
    expect(RefreshToken.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(RefreshToken.create).mock.calls[0][0]).toMatchObject({
      user_id: 42,
      is_revoked: false,
      token: hashToken(tokens.refreshToken),
    });
    expect(vi.mocked(RefreshToken.create).mock.calls[0][0]).not.toMatchObject({
      token: tokens.refreshToken,
    });
  });

  it('allows two logins for the same user to leave two refresh tokens', async () => {
    const created: string[] = [];
    vi.mocked(RefreshToken.create).mockImplementation(async (values) => {
      created.push((values as { token: string }).token);
      return {} as never;
    });

    const first = await generateTokens(7);
    const second = await generateTokens(7);

    expect(created).toEqual([hashToken(first.refreshToken), hashToken(second.refreshToken)]);
    expect(first.refreshToken).not.toBe(second.refreshToken);
    expect(RefreshToken.destroy).not.toHaveBeenCalled();
  });
});

describe('refreshUserTokens (multi-session)', () => {
  it('rotates only the presented refresh token and leaves other sessions intact', async () => {
    const oldRefresh = jwt.sign(
      { userId: 3, tokenId: 'old-session' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '28d' }
    );

    const destroy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(RefreshToken.findOne).mockResolvedValue({
      token: hashToken(oldRefresh),
      user_id: 3,
      is_revoked: false,
      expires_at: new Date(Date.now() + 86_400_000),
      destroy,
    } as never);

    vi.mocked(User.findByPk).mockResolvedValue({
      id: 3,
      email: 'vitest_test_multi@example.com',
    } as never);

    vi.mocked(RefreshToken.create).mockResolvedValue({} as never);

    const { tokens } = await refreshUserTokens(oldRefresh);

    expect(RefreshToken.create).toHaveBeenCalledTimes(1);
    expect(tokens.refreshToken).not.toBe(oldRefresh);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(RefreshToken.destroy).not.toHaveBeenCalledWith({
      where: { user_id: 3 },
    });
  });
});

describe('revokeRefreshToken', () => {
  it('removes the matching hashed refresh token row', async () => {
    vi.mocked(RefreshToken.destroy).mockResolvedValue(1 as never);

    await revokeRefreshToken('session-to-revoke');

    expect(RefreshToken.destroy).toHaveBeenCalledWith({
      where: { token: hashToken('session-to-revoke') },
    });
  });
});
