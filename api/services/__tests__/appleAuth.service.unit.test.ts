import { createHash, generateKeyPairSync, type JsonWebKey } from 'crypto';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_ACCESS_SECRET = 'unit-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret';
process.env.APPLE_BUNDLE_ID = 'uk.co.mealdiary.app';

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

vi.mock('../../db/models/User.model.ts', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../db/models/RefreshToken.model.ts', () => ({
  default: {
    create: vi.fn(),
  },
}));

import User from '../../db/models/User.model.ts';
import RefreshToken from '../../db/models/RefreshToken.model.ts';
import {
  authenticateUser,
  authenticateWithAppleToken,
  clearApplePublicKeyCache,
  verifyAppleIdToken,
} from '../auth.service.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const appleJwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'test-key',
  alg: 'RS256',
  use: 'sig',
} as JsonWebKey & { kid: string };

const RAW_NONCE = 'unit-test-raw-nonce';
const NONCE_HASH = createHash('sha256').update(RAW_NONCE).digest('hex');

function signAppleToken(
  claims: Record<string, unknown> = {},
  audience = 'uk.co.mealdiary.app'
): string {
  const payload: Record<string, unknown> = {
    nonce: NONCE_HASH,
    email: 'ada@example.com',
    email_verified: true,
    ...claims,
  };

  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  }

  const subject = typeof payload.sub === 'string' ? payload.sub : 'apple-user-1';
  delete payload.sub;

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    issuer: 'https://appleid.apple.com',
    audience,
    expiresIn: '5m',
    subject,
    keyid: 'test-key',
  });
}

interface FakeUser {
  id: number;
  email: string;
  username: string;
  apple_id?: string;
  google_id?: string;
  password_hash?: string;
  first_name?: string;
  last_name?: string;
  normalized_email?: string;
  update: ReturnType<typeof vi.fn>;
}

function userRow(overrides: Partial<FakeUser> = {}): FakeUser {
  const row: FakeUser = {
    id: 1,
    email: 'ada@example.com',
    username: 'ada',
    normalized_email: 'ada@example.com',
    update: vi.fn(),
    ...overrides,
  };
  row.update.mockImplementation(async (updates: Partial<FakeUser>) => {
    Object.assign(row, updates);
    return row;
  });
  return row;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearApplePublicKeyCache();
  process.env.APPLE_BUNDLE_ID = 'uk.co.mealdiary.app';
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ keys: [appleJwk] }),
    }))
  );
  vi.mocked(RefreshToken.create).mockResolvedValue({} as never);
});

describe('verifyAppleIdToken', () => {
  it('rejects a token whose audience is not the app bundle id', async () => {
    const idToken = signAppleToken({}, 'com.other.app');

    await expect(verifyAppleIdToken(idToken, RAW_NONCE)).rejects.toThrow('Invalid token');
  });

  it('rejects a token when the raw nonce does not match', async () => {
    const idToken = signAppleToken();

    await expect(verifyAppleIdToken(idToken, 'different-nonce')).rejects.toThrow('Invalid nonce');
  });

  it('rejects an unverified email', async () => {
    const idToken = signAppleToken({ email_verified: false });

    await expect(verifyAppleIdToken(idToken, RAW_NONCE)).rejects.toThrow('Invalid token');
  });
});

describe('authenticateWithAppleToken', () => {
  it('creates a user from a first-time Apple sign-in, including the client-supplied name', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null);
    vi.mocked(User.create).mockImplementation(async (values) => {
      return userRow(values as Partial<FakeUser>) as never;
    });

    const idToken = signAppleToken({
      sub: 'apple-user-1',
      email: 'Ada@Example.com',
    });

    const result = await authenticateWithAppleToken(idToken, RAW_NONCE, {
      givenName: 'Ada',
      familyName: 'Lovelace',
    });

    expect(result.isNewUser).toBe(true);
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        apple_id: 'apple-user-1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        username: 'ada',
        password_hash: undefined,
        terms_accepted_at: expect.any(Date),
      })
    );
    expect(result.tokens.accessToken).toBeTruthy();
  });

  it('links an existing account when the Apple email matches and apple_id is empty', async () => {
    const existing = userRow({
      google_id: 'google-1',
      first_name: 'Existing',
      apple_id: undefined,
    });

    vi.mocked(User.findOne).mockImplementation((async (options: { where?: Record<string, string> }) => {
      const where = options?.where ?? {};
      if (where.apple_id) {
        return null;
      }
      if (where.email === 'ada@example.com') {
        return existing;
      }
      return null;
    }) as never);

    const idToken = signAppleToken({ email: 'ada@example.com' });
    const result = await authenticateWithAppleToken(idToken, RAW_NONCE, {
      givenName: 'Ada',
      familyName: 'Lovelace',
    });

    expect(result.isNewUser).toBe(false);
    expect(User.create).not.toHaveBeenCalled();
    expect(existing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        apple_id: 'apple-user-1',
        last_name: 'Lovelace',
      })
    );
    expect(existing.update.mock.calls[0][0]).not.toHaveProperty('first_name');
    expect(existing.apple_id).toBe('apple-user-1');
  });

  it('signs in a returning user by apple_id when Apple omits the email', async () => {
    const existing = userRow({ apple_id: 'apple-user-1' });

    vi.mocked(User.findOne).mockImplementation((async (options: { where?: Record<string, string> }) => {
      const where = options?.where ?? {};
      if (where.apple_id === 'apple-user-1') {
        return existing;
      }
      return null;
    }) as never);

    const idToken = signAppleToken({ email: undefined, email_verified: undefined });
    const result = await authenticateWithAppleToken(idToken, RAW_NONCE);

    expect(result.isNewUser).toBe(false);
    expect(result.user).toBe(existing);
    expect(User.create).not.toHaveBeenCalled();
  });

  it('creates a separate user for a Hide My Email address', async () => {
    vi.mocked(User.findOne).mockImplementation((async (options: { where?: Record<string, string> }) => {
      const where = options?.where ?? {};
      if (where.email === 'jake@example.com') {
        return userRow({ email: 'jake@example.com', apple_id: undefined });
      }
      if (where.username === 'abc') {
        return userRow({ username: 'abc' });
      }
      return null;
    }) as never);
    vi.mocked(User.create).mockImplementation(async (values) => userRow(values as Partial<FakeUser>) as never);

    const idToken = signAppleToken({
      sub: 'apple-relay',
      email: 'abc@privaterelay.appleid.com',
    });

    await authenticateWithAppleToken(idToken, RAW_NONCE);

    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'abc@privaterelay.appleid.com',
        apple_id: 'apple-relay',
        username: 'abc1',
      })
    );
  });

  it('does not replace an apple_id that is already set', async () => {
    const existing = userRow({ apple_id: 'original-apple', first_name: 'Ada', last_name: 'Lovelace' });

    vi.mocked(User.findOne).mockImplementation((async (options: { where?: Record<string, string> }) => {
      const where = options?.where ?? {};
      if (where.email === 'ada@example.com') {
        return existing;
      }
      return null;
    }) as never);

    const idToken = signAppleToken({ sub: 'different-apple', email: 'ada@example.com' });
    await authenticateWithAppleToken(idToken, RAW_NONCE, { givenName: 'Other' });

    expect(existing.apple_id).toBe('original-apple');
    expect(existing.update).not.toHaveBeenCalled();
  });
});

describe('authenticateUser passwordless accounts', () => {
  it('tells Apple-only accounts to sign in with Apple', async () => {
    vi.mocked(User.findOne).mockResolvedValue(
      userRow({ password_hash: undefined, apple_id: 'apple-1', google_id: undefined }) as never
    );

    await expect(
      authenticateUser({ email: 'ada@example.com', password: 'secret' })
    ).rejects.toThrow('Invalid credentials. Please sign in with Apple.');
  });

  it('tells Google-only accounts to sign in with Google', async () => {
    vi.mocked(User.findOne).mockResolvedValue(
      userRow({ password_hash: undefined, apple_id: undefined, google_id: 'google-1' }) as never
    );

    await expect(
      authenticateUser({ email: 'ada@example.com', password: 'secret' })
    ).rejects.toThrow('Invalid credentials. Please sign in with Google.');
  });

  it('mentions both providers when the account has Apple and Google', async () => {
    vi.mocked(User.findOne).mockResolvedValue(
      userRow({ password_hash: undefined, apple_id: 'apple-1', google_id: 'google-1' }) as never
    );

    await expect(
      authenticateUser({ email: 'ada@example.com', password: 'secret' })
    ).rejects.toThrow('Invalid credentials. Please sign in with Apple or Google.');
  });
});
