import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURE_FLAGS } from '@meal-diary/shared';
import sequelize from '../../db/models/index.ts';
import User from '../../db/models/User.model.ts';
import AlexaLink from '../../db/models/AlexaLink.model.ts';
import AlexaAccessToken from '../../db/models/AlexaAccessToken.model.ts';
import AlexaAuthorizationCode from '../../db/models/AlexaAuthorizationCode.model.ts';
import { isFeatureEnabled } from '../../utils/posthog.ts';
import { EntitlementRequiredError } from '../entitlements.service.ts';
import * as EntitlementsService from '../entitlements.service.ts';
import {
  AlexaFamilyRequiredError,
  AlexaOAuthRequestError,
  AlexaTokenError,
  createAlexaAuthorization,
  disconnectAlexaLink,
  grantAlexaTokens,
} from '../alexaOAuth.service.ts';

vi.mock('../../utils/posthog.ts', async () => {
  const actual = await vi.importActual<typeof import('../../utils/posthog.ts')>(
    '../../utils/posthog.ts'
  );
  return {
    ...actual,
    isFeatureEnabled: vi.fn(),
  };
});

const CLIENT_ID = 'alexa-client';
const CLIENT_SECRET = 'alexa-secret';
const REDIRECT_URI = 'https://pitangui.amazon.com/api/skill/link/M123';
const TEN_MINUTES_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 180 * DAY_MS;

const premiumUser = {
  dataValues: { id: 3, family_group_id: 9 },
} as User;

const authorizeBody = {
  clientId: CLIENT_ID,
  redirectUri: REDIRECT_URI,
  state: 'state value',
  scope: 'meal-diary:read',
  responseType: 'code',
};

const tokenClient = {
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
};

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.ALEXA_OAUTH_CLIENT_ID = CLIENT_ID;
  process.env.ALEXA_OAUTH_CLIENT_SECRET = CLIENT_SECRET;
  vi.mocked(isFeatureEnabled).mockResolvedValue(true);
  vi.spyOn(EntitlementsService, 'assertFeature').mockResolvedValue({} as never);
  vi.spyOn(sequelize, 'transaction').mockImplementation((async (callback: (transaction: {
    LOCK: { UPDATE: string };
  }) => Promise<unknown>) => callback({ LOCK: { UPDATE: 'UPDATE' } })) as never);
  vi.spyOn(AlexaAuthorizationCode, 'create').mockResolvedValue({ dataValues: { id: 1 } } as never);
  vi.spyOn(AlexaAuthorizationCode, 'findOne').mockResolvedValue(null);
  vi.spyOn(AlexaAuthorizationCode, 'destroy').mockResolvedValue(0);
  vi.spyOn(AlexaLink, 'findOne').mockResolvedValue(null);
  vi.spyOn(AlexaLink, 'create').mockResolvedValue({ dataValues: { id: 11 } } as never);
  vi.spyOn(AlexaAccessToken, 'create').mockResolvedValue({ dataValues: { id: 21 } } as never);
  vi.spyOn(AlexaAccessToken, 'destroy').mockResolvedValue(0);
  vi.spyOn(User, 'findByPk').mockResolvedValue(null);
});

const expectAbout = (actual: number, expected: number) => {
  expect(Math.abs(actual - expected)).toBeLessThan(5000);
};

describe('alexaOAuth.service', () => {
  it('rejects a client id that does not match', async () => {
    await expect(
      createAlexaAuthorization(premiumUser, { ...authorizeBody, clientId: 'other-client' })
    ).rejects.toBeInstanceOf(AlexaOAuthRequestError);
    expect(AlexaAuthorizationCode.create).not.toHaveBeenCalled();

    await expect(
      grantAlexaTokens({
        ...tokenClient,
        client_secret: 'wrong-secret',
        grant_type: 'refresh_token',
        refresh_token: 'refresh',
      })
    ).rejects.toMatchObject({ status: 401, oauthError: 'invalid_client' });
    expect(isFeatureEnabled).not.toHaveBeenCalled();
  });

  it('rejects a redirect host that is not an Alexa account-linking host', async () => {
    await expect(
      createAlexaAuthorization(premiumUser, {
        ...authorizeBody,
        redirectUri: 'https://example.com/api/skill/link/M123',
      })
    ).rejects.toBeInstanceOf(AlexaOAuthRequestError);
    expect(AlexaAuthorizationCode.create).not.toHaveBeenCalled();
  });

  it('issues a ten-minute code and does not touch an existing link', async () => {
    const result = await createAlexaAuthorization(premiumUser, authorizeBody);
    const created = vi.mocked(AlexaAuthorizationCode.create).mock.calls[0]?.[0];
    const redirectUrl = new URL(result.redirectUrl);
    const code = redirectUrl.searchParams.get('code');

    expect(code).toBeTruthy();
    expect(redirectUrl.searchParams.get('state')).toBe('state value');
    expect(redirectUrl.hostname).toBe('pitangui.amazon.com');
    expect(created?.code_hash).toBe(createHash('sha256').update(code ?? '').digest('hex'));
    expectAbout(
      new Date(created?.expires_at ?? 0).getTime() - Date.now(),
      TEN_MINUTES_MS
    );
    expect(AlexaLink.create).not.toHaveBeenCalled();
    expect(AlexaLink.findOne).not.toHaveBeenCalled();
  });

  it('exchanges a code once for an hour-long access token and a 180-day refresh token', async () => {
    const rawCode = 'one-time-code';
    let usedAt: Date | null = null;
    vi.spyOn(AlexaAuthorizationCode, 'findOne').mockImplementation(async () => ({
      dataValues: {
        id: 4,
        user_id: 42,
        redirect_uri: REDIRECT_URI,
        expires_at: new Date(Date.now() + TEN_MINUTES_MS),
        used_at: usedAt,
      },
      update: vi.fn(async (values: { used_at?: Date }) => {
        if (values.used_at) {
          usedAt = values.used_at;
        }
      }),
    }) as never);
    vi.spyOn(User, 'findByPk').mockResolvedValue({
      dataValues: { id: 42, family_group_id: 9 },
    } as never);

    const first = await grantAlexaTokens({
      ...tokenClient,
      grant_type: 'authorization_code',
      code: rawCode,
      redirect_uri: REDIRECT_URI,
    });

    expect(first.expires_in).toBe(3600);
    expect(first.token_type).toBe('Bearer');
    expect(first.access_token).toBeTruthy();
    expect(first.refresh_token).toBeTruthy();

    const linkValues = vi.mocked(AlexaLink.create).mock.calls[0]?.[0];
    expectAbout(
      new Date(linkValues?.refresh_expires_at ?? 0).getTime() - Date.now(),
      REFRESH_TTL_MS
    );
    const accessValues = vi.mocked(AlexaAccessToken.create).mock.calls[0]?.[0];
    expectAbout(new Date(accessValues?.expires_at ?? 0).getTime() - Date.now(), 3600 * 1000);
    expect(linkValues?.refresh_token_hash).toBe(
      createHash('sha256').update(first.refresh_token).digest('hex')
    );

    await expect(
      grantAlexaTokens({
        ...tokenClient,
        grant_type: 'authorization_code',
        code: rawCode,
        redirect_uri: REDIRECT_URI,
      })
    ).rejects.toBeInstanceOf(AlexaTokenError);
    expect(AlexaLink.create).toHaveBeenCalledTimes(1);
  });

  it('replaces the existing link instead of creating a second one', async () => {
    const linkUpdate = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(AlexaAuthorizationCode, 'findOne').mockResolvedValue({
      dataValues: {
        id: 4,
        user_id: 42,
        redirect_uri: REDIRECT_URI,
        expires_at: new Date(Date.now() + TEN_MINUTES_MS),
        used_at: null,
      },
      update: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.spyOn(User, 'findByPk').mockResolvedValue({
      dataValues: { id: 42, family_group_id: 9 },
    } as never);
    vi.spyOn(AlexaLink, 'findOne').mockResolvedValue({
      dataValues: { id: 5, user_id: 42, revoked_at: null },
      update: linkUpdate,
    } as never);

    await grantAlexaTokens({
      ...tokenClient,
      grant_type: 'authorization_code',
      code: 'second-link',
      redirect_uri: REDIRECT_URI,
    });

    expect(AlexaLink.create).not.toHaveBeenCalled();
    expect(AlexaAccessToken.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { alexa_link_id: 5 } })
    );
    expect(linkUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ revoked_at: null, refresh_token_hash: expect.any(String) }),
      expect.anything()
    );
  });

  it('slides the same refresh token forward by 180 days without checking premium', async () => {
    const rawRefresh = 'refresh-token-value';
    const linkUpdate = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(AlexaLink, 'findOne').mockResolvedValue({
      dataValues: {
        id: 5,
        user_id: 3,
        revoked_at: null,
        refresh_expires_at: new Date(Date.now() + DAY_MS),
      },
      update: linkUpdate,
    } as never);
    vi.spyOn(User, 'findByPk').mockResolvedValue({
      dataValues: { id: 3, family_group_id: null },
    } as never);

    const result = await grantAlexaTokens({
      ...tokenClient,
      grant_type: 'refresh_token',
      refresh_token: rawRefresh,
    });

    expect(result.refresh_token).toBe(rawRefresh);
    expect(result.expires_in).toBe(3600);
    expect(EntitlementsService.assertFeature).not.toHaveBeenCalled();
    const update = linkUpdate.mock.calls[0]?.[0] as { refresh_expires_at: Date; refresh_token_hash?: string };
    expect(update.refresh_token_hash).toBeUndefined();
    expectAbout(update.refresh_expires_at.getTime() - Date.now(), REFRESH_TTL_MS);
    expect(AlexaAccessToken.destroy).not.toHaveBeenCalled();
  });

  it('refuses authorize and code exchange without a family or without Alexa', async () => {
    const noFamily = { dataValues: { id: 3, family_group_id: null } } as User;
    await expect(createAlexaAuthorization(noFamily, authorizeBody)).rejects.toBeInstanceOf(
      AlexaFamilyRequiredError
    );
    expect(EntitlementsService.assertFeature).not.toHaveBeenCalled();

    vi.mocked(EntitlementsService.assertFeature).mockRejectedValue(
      new EntitlementRequiredError('alexa', 'free')
    );
    await expect(createAlexaAuthorization(premiumUser, authorizeBody)).rejects.toBeInstanceOf(
      EntitlementRequiredError
    );

    vi.spyOn(AlexaAuthorizationCode, 'findOne').mockResolvedValue({
      dataValues: {
        id: 4,
        user_id: 42,
        redirect_uri: REDIRECT_URI,
        expires_at: new Date(Date.now() + TEN_MINUTES_MS),
        used_at: null,
      },
      update: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.spyOn(User, 'findByPk').mockResolvedValue({
      dataValues: { id: 42, family_group_id: null },
    } as never);

    await expect(
      grantAlexaTokens({
        ...tokenClient,
        grant_type: 'authorization_code',
        code: 'family-missing',
        redirect_uri: REDIRECT_URI,
      })
    ).rejects.toMatchObject({ status: 400, oauthError: 'invalid_grant' });

    vi.spyOn(User, 'findByPk').mockResolvedValue({
      dataValues: { id: 42, family_group_id: 9 },
    } as never);
    await expect(
      grantAlexaTokens({
        ...tokenClient,
        grant_type: 'authorization_code',
        code: 'not-premium',
        redirect_uri: REDIRECT_URI,
      })
    ).rejects.toMatchObject({ status: 400, oauthError: 'invalid_grant' });
    expect(AlexaLink.create).not.toHaveBeenCalled();
  });

  it('returns invalid_grant when the Alexa flag is off for that user', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false);
    vi.spyOn(AlexaAuthorizationCode, 'findOne').mockResolvedValue({
      dataValues: {
        id: 4,
        user_id: 42,
        redirect_uri: REDIRECT_URI,
        expires_at: new Date(Date.now() + TEN_MINUTES_MS),
        used_at: null,
      },
      update: vi.fn(),
    } as never);

    await expect(
      grantAlexaTokens({
        ...tokenClient,
        grant_type: 'authorization_code',
        code: 'flag-off',
        redirect_uri: REDIRECT_URI,
      })
    ).rejects.toMatchObject({ status: 400, oauthError: 'invalid_grant' });

    expect(isFeatureEnabled).toHaveBeenCalledWith('42', FEATURE_FLAGS.alexaConnection);
    expect(AlexaAccessToken.create).not.toHaveBeenCalled();
    expect(AlexaLink.create).not.toHaveBeenCalled();
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it('revokes refresh after disconnect', async () => {
    let revokedAt: Date | null = null;
    const linkUpdate = vi.fn(async (values: { revoked_at?: Date }) => {
      if (values.revoked_at) {
        revokedAt = values.revoked_at;
      }
    });
    vi.spyOn(AlexaLink, 'findOne').mockImplementation(async () => ({
      dataValues: {
        id: 5,
        user_id: 3,
        revoked_at: revokedAt,
        refresh_expires_at: new Date(Date.now() + REFRESH_TTL_MS),
      },
      update: linkUpdate,
    }) as never);
    vi.spyOn(User, 'findByPk').mockResolvedValue({
      dataValues: { id: 3, family_group_id: 9 },
    } as never);

    await disconnectAlexaLink(3);

    expect(linkUpdate).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(Date) }));
    expect(AlexaAccessToken.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { alexa_link_id: 5 } })
    );
    expect(AlexaAuthorizationCode.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 3, used_at: null } })
    );

    await expect(
      grantAlexaTokens({
        ...tokenClient,
        grant_type: 'refresh_token',
        refresh_token: 'revoked-refresh',
      })
    ).rejects.toMatchObject({ status: 400, oauthError: 'invalid_grant' });
  });
});
