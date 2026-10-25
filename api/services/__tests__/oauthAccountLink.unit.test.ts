import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createOAuthLinkChallenge, findActiveOAuthLinkChallenge, markOAuthLinkChallengeUsed } = vi.hoisted(() => ({
  createOAuthLinkChallenge: vi.fn(async () => 'link-token-raw'),
  findActiveOAuthLinkChallenge: vi.fn(),
  markOAuthLinkChallengeUsed: vi.fn(),
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

vi.mock('../../db/models/User.model.ts', () => ({
  default: {
    findOne: vi.fn(),
    findByPk: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../db/models/RefreshToken.model.ts', () => ({
  default: {
    create: vi.fn(),
    destroy: vi.fn(),
  },
}));

vi.mock('../oauthLink.service.ts', () => ({
  createOAuthLinkChallenge,
  findActiveOAuthLinkChallenge,
  markOAuthLinkChallengeUsed,
}));

process.env.JWT_ACCESS_SECRET = 'unit-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret';

import bcrypt from 'bcrypt';
import User from '../../db/models/User.model.ts';
import RefreshToken from '../../db/models/RefreshToken.model.ts';
import { completeOAuthAccountLink, findOrCreateGoogleUser } from '../auth.service.ts';

interface FakeUser {
  id: number;
  email: string;
  username: string;
  google_id?: string;
  password_hash?: string | null;
  normalized_email?: string;
  avatar_url?: string;
  first_name?: string;
  update: ReturnType<typeof vi.fn>;
}

function userRow(overrides: Partial<FakeUser> = {}): FakeUser {
  const row: FakeUser = {
    id: 3,
    email: 'ada@example.com',
    username: 'ada',
    normalized_email: 'ada@example.com',
    password_hash: 'stored-hash',
    update: vi.fn(),
    ...overrides,
  };
  row.update.mockImplementation(async (updates: Partial<FakeUser>) => {
    Object.assign(row, updates);
    return row;
  });
  return row;
}

const googleProfile = {
  id: 'google-1',
  email: 'ada@example.com',
  emailVerified: true,
  given_name: 'Ada',
  family_name: 'Lovelace',
  picture: 'https://example.com/ada.png',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findOrCreateGoogleUser password accounts', () => {
  it('does not attach Google until the current password is proved', async () => {
    const existing = userRow();
    vi.mocked(User.findOne).mockImplementation((async (options: { where?: Record<string, string> }) => {
      const where = options?.where ?? {};
      if (where.email === 'ada@example.com') return existing;
      return null;
    }) as never);

    await expect(findOrCreateGoogleUser(googleProfile)).rejects.toMatchObject({
      code: 'password_link_required',
      linkToken: 'link-token-raw',
    });
    expect(existing.update).not.toHaveBeenCalled();
    expect(createOAuthLinkChallenge).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'google',
      subject: 'google-1',
      userId: 3,
    }));
  });

  it('clears the password and refresh tokens when the password matches', async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    const existing = userRow();
    vi.mocked(User.findOne).mockImplementation((async (options: { where?: Record<string, string> }) => {
      const where = options?.where ?? {};
      if (where.email === 'ada@example.com') return existing;
      return null;
    }) as never);

    const user = await findOrCreateGoogleUser(googleProfile, 'Password1!');

    expect(user.google_id).toBe('google-1');
    expect(user.password_hash).toBeNull();
    expect(RefreshToken.destroy).toHaveBeenCalledWith({ where: { user_id: 3 } });
  });

  it('still links a passwordless account by verified email', async () => {
    const existing = userRow({ password_hash: null, google_id: undefined });
    vi.mocked(User.findOne).mockImplementation((async (options: { where?: Record<string, string> }) => {
      const where = options?.where ?? {};
      if (where.email === 'ada@example.com') return existing;
      return null;
    }) as never);

    await findOrCreateGoogleUser(googleProfile);

    expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({ google_id: 'google-1' }));
    expect(existing.update.mock.calls[0][0]).not.toHaveProperty('password_hash');
    expect(createOAuthLinkChallenge).not.toHaveBeenCalled();
    expect(RefreshToken.destroy).not.toHaveBeenCalled();
  });
});

describe('completeOAuthAccountLink', () => {
  it('rejects a wrong password without consuming the challenge', async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    const existing = userRow();
    vi.mocked(findActiveOAuthLinkChallenge).mockResolvedValue({
      id: 9,
      user_id: 3,
      provider: 'google',
      subject: 'google-1',
      email: 'ada@example.com',
      profile_json: '{}',
    } as never);
    vi.mocked(User.findByPk).mockResolvedValue(existing as never);

    await expect(completeOAuthAccountLink('raw-link', 'wrong')).rejects.toThrow('Incorrect password');
    expect(existing.update).not.toHaveBeenCalled();
    expect(markOAuthLinkChallengeUsed).not.toHaveBeenCalled();
  });

  it('links the provider, clears the password, and issues a new session', async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    const existing = userRow({ first_name: undefined });
    vi.mocked(findActiveOAuthLinkChallenge).mockResolvedValue({
      id: 9,
      user_id: 3,
      provider: 'google',
      subject: 'google-1',
      email: 'ada@example.com',
      profile_json: JSON.stringify({ givenName: 'Ada', avatarUrl: 'https://example.com/ada.png' }),
    } as never);
    vi.mocked(User.findByPk).mockResolvedValue(existing as never);

    const result = await completeOAuthAccountLink('raw-link', 'Password1!');

    expect(existing.google_id).toBe('google-1');
    expect(existing.password_hash).toBeNull();
    expect(existing.first_name).toBe('Ada');
    expect(RefreshToken.destroy).toHaveBeenCalledWith({ where: { user_id: 3 } });
    expect(markOAuthLinkChallengeUsed).toHaveBeenCalledWith(9);
    expect(RefreshToken.create).toHaveBeenCalled();
    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.tokens.refreshToken).toEqual(expect.any(String));
  });
});
