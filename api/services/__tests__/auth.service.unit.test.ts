import { describe, it, expect, vi, beforeEach } from 'vitest';
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

import User from '../../db/models/User.model.ts';
import RefreshToken from '../../db/models/RefreshToken.model.ts';
import {
  generateTokens,
  refreshUserTokens,
  revokeRefreshToken,
} from '../auth.service.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateTokens (multi-session)', () => {
  it('creates a refresh token without deleting existing sessions for the user', async () => {
    vi.mocked(RefreshToken.create).mockResolvedValue({} as never);

    const tokens = await generateTokens(42);

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(RefreshToken.destroy).not.toHaveBeenCalled();
    expect(RefreshToken.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(RefreshToken.create).mock.calls[0][0]).toMatchObject({
      user_id: 42,
      is_revoked: false,
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

    expect(created).toEqual([first.refreshToken, second.refreshToken]);
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

    vi.mocked(RefreshToken.findOne).mockResolvedValue({
      token: oldRefresh,
      user_id: 3,
      is_revoked: false,
      expires_at: new Date(Date.now() + 86_400_000),
    } as never);

    vi.mocked(User.findByPk).mockResolvedValue({
      id: 3,
      email: 'vitest_test_multi@example.com',
    } as never);

    vi.mocked(RefreshToken.create).mockResolvedValue({} as never);
    vi.mocked(RefreshToken.destroy).mockResolvedValue(1 as never);

    const { tokens } = await refreshUserTokens(oldRefresh);

    expect(RefreshToken.create).toHaveBeenCalledTimes(1);
    expect(tokens.refreshToken).not.toBe(oldRefresh);
    expect(RefreshToken.destroy).toHaveBeenCalledWith({
      where: { token: oldRefresh },
    });
    expect(RefreshToken.destroy).not.toHaveBeenCalledWith({
      where: { user_id: 3 },
    });
  });
});

describe('revokeRefreshToken', () => {
  it('removes only the matching refresh token row', async () => {
    vi.mocked(RefreshToken.destroy).mockResolvedValue(1 as never);

    await revokeRefreshToken('session-to-revoke');

    expect(RefreshToken.destroy).toHaveBeenCalledWith({
      where: { token: 'session-to-revoke' },
    });
  });
});
