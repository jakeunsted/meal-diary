import crypto from 'crypto';
import type { AlexaLinkStatus } from '@meal-diary/shared';
import { FEATURE_FLAGS } from '@meal-diary/shared';
import sequelize from '../db/models/index.ts';
import User from '../db/models/User.model.ts';
import AlexaLink from '../db/models/AlexaLink.model.ts';
import AlexaAccessToken from '../db/models/AlexaAccessToken.model.ts';
import AlexaAuthorizationCode from '../db/models/AlexaAuthorizationCode.model.ts';
import * as EntitlementsService from './entitlements.service.ts';
import { isFeatureEnabled } from '../utils/posthog.ts';

const ALEXA_SCOPE = 'meal-diary:read';
const AUTHORIZATION_CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 3600;
const REFRESH_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_STATE_LENGTH = 512;

const ALEXA_REDIRECT_HOSTS = new Set([
  'pitangui.amazon.com',
  'layla.amazon.com',
  'alexa.amazon.co.jp',
]);

export class AlexaOAuthRequestError extends Error {
  readonly code = 'INVALID_OAUTH_REQUEST' as const;

  constructor() {
    super('INVALID_OAUTH_REQUEST');
    this.name = 'AlexaOAuthRequestError';
  }
}

export class AlexaFamilyRequiredError extends Error {
  readonly code = 'FAMILY_REQUIRED' as const;

  constructor() {
    super('FAMILY_REQUIRED');
    this.name = 'AlexaFamilyRequiredError';
  }
}

export type AlexaOAuthTokenErrorCode =
  | 'invalid_client'
  | 'invalid_grant'
  | 'invalid_request'
  | 'unsupported_grant_type';

export class AlexaTokenError extends Error {
  constructor(
    readonly status: number,
    readonly oauthError: AlexaOAuthTokenErrorCode
  ) {
    super(oauthError);
    this.name = 'AlexaTokenError';
  }
}

export interface AlexaAuthorizeResult {
  redirectUrl: string;
}

export interface AlexaOAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
}

const sha256Hex = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

const safeEqual = (left: string, right: string): boolean => {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuf, rightBuf);
};

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asRecord = (body: unknown): Record<string, unknown> => {
  if (!body || typeof body !== 'object') {
    return {};
  }
  return body as Record<string, unknown>;
};

const randomSecret = (): string => crypto.randomBytes(32).toString('base64url');

const assertRedirectUri = (redirectUri: string): void => {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    throw new AlexaOAuthRequestError();
  }

  if (url.protocol !== 'https:') {
    throw new AlexaOAuthRequestError();
  }
  if (url.username || url.password) {
    throw new AlexaOAuthRequestError();
  }
  if (url.port !== '' && url.port !== '443') {
    throw new AlexaOAuthRequestError();
  }
  if (!ALEXA_REDIRECT_HOSTS.has(url.hostname)) {
    throw new AlexaOAuthRequestError();
  }
  if (!url.pathname.startsWith('/api/skill/link/')) {
    throw new AlexaOAuthRequestError();
  }
};

const assertClient = (clientId: string | undefined, clientSecret: string | undefined): void => {
  const expectedId = process.env.ALEXA_OAUTH_CLIENT_ID;
  const expectedSecret = process.env.ALEXA_OAUTH_CLIENT_SECRET;
  if (
    !expectedId ||
    !expectedSecret ||
    !clientId ||
    !clientSecret ||
    !safeEqual(clientId, expectedId) ||
    !safeEqual(clientSecret, expectedSecret)
  ) {
    throw new AlexaTokenError(401, 'invalid_client');
  }
};

const isActiveLink = (link: AlexaLink): boolean => {
  if (link.dataValues.revoked_at) {
    return false;
  }
  return new Date(link.dataValues.refresh_expires_at).getTime() > Date.now();
};

const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export const createAlexaAuthorization = async (
  user: User,
  body: unknown
): Promise<AlexaAuthorizeResult> => {
  const input = asRecord(body);
  const responseType = readString(input.responseType);
  const clientId = readString(input.clientId);
  const redirectUri = readString(input.redirectUri);
  const state = readString(input.state);
  const scope = input.scope;

  if (responseType !== 'code') {
    throw new AlexaOAuthRequestError();
  }

  const expectedClientId = process.env.ALEXA_OAUTH_CLIENT_ID;
  if (!expectedClientId || !clientId || !safeEqual(clientId, expectedClientId)) {
    throw new AlexaOAuthRequestError();
  }

  if (!redirectUri) {
    throw new AlexaOAuthRequestError();
  }
  assertRedirectUri(redirectUri);

  if (
    state === undefined ||
    state.length === 0 ||
    state.length > MAX_STATE_LENGTH ||
    /[\r\n]/.test(state)
  ) {
    throw new AlexaOAuthRequestError();
  }

  if (scope !== undefined && scope !== null && scope !== '' && scope !== ALEXA_SCOPE) {
    throw new AlexaOAuthRequestError();
  }

  const familyGroupId = user.dataValues.family_group_id;
  if (familyGroupId === null || familyGroupId === undefined) {
    throw new AlexaFamilyRequiredError();
  }

  await EntitlementsService.assertFeature(familyGroupId, user.dataValues.id, 'alexa');

  const rawCode = randomSecret();
  await AlexaAuthorizationCode.create({
    user_id: user.dataValues.id,
    code_hash: sha256Hex(rawCode),
    redirect_uri: redirectUri,
    expires_at: new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS),
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', rawCode);
  redirectUrl.searchParams.set('state', state);
  return { redirectUrl: redirectUrl.toString() };
};

interface TokenRequestFields {
  grantType: string;
  code?: string;
  redirectUri?: string;
  refreshToken?: string;
}

const readTokenRequest = (body: unknown): TokenRequestFields => {
  const input = asRecord(body);
  const grantType = readString(input.grant_type);
  if (!grantType) {
    throw new AlexaTokenError(400, 'invalid_request');
  }
  if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
    throw new AlexaTokenError(400, 'unsupported_grant_type');
  }

  assertClient(readString(input.client_id), readString(input.client_secret));

  if (grantType === 'authorization_code') {
    const code = readString(input.code);
    const redirectUri = readString(input.redirect_uri);
    if (!code || !redirectUri) {
      throw new AlexaTokenError(400, 'invalid_request');
    }
    return { grantType, code, redirectUri };
  }

  const refreshToken = readString(input.refresh_token);
  if (!refreshToken) {
    throw new AlexaTokenError(400, 'invalid_request');
  }
  return { grantType, refreshToken };
};

/**
 * Resolve the Meal Diary user from an authorization code or refresh token.
 * Callers evaluate the feature flag with this id. Do not use the caller IP.
 */
export const identifyAlexaGrantUser = async (body: unknown): Promise<number> => {
  const request = readTokenRequest(body);

  if (request.grantType === 'authorization_code' && request.code && request.redirectUri) {
    const code = await AlexaAuthorizationCode.findOne({
      where: { code_hash: sha256Hex(request.code) },
    });
    if (
      !code ||
      code.dataValues.used_at ||
      new Date(code.dataValues.expires_at).getTime() <= Date.now() ||
      code.dataValues.redirect_uri !== request.redirectUri
    ) {
      throw new AlexaTokenError(400, 'invalid_grant');
    }
    return code.dataValues.user_id;
  }

  if (!request.refreshToken) {
    throw new AlexaTokenError(400, 'invalid_request');
  }

  const link = await AlexaLink.findOne({
    where: { refresh_token_hash: sha256Hex(request.refreshToken) },
  });
  if (!link || !isActiveLink(link)) {
    throw new AlexaTokenError(400, 'invalid_grant');
  }

  const user = await User.findByPk(link.dataValues.user_id);
  if (!user) {
    throw new AlexaTokenError(400, 'invalid_grant');
  }
  return user.dataValues.id;
};

const issueAuthorizationCode = async (
  codeValue: string,
  redirectUri: string
): Promise<AlexaOAuthTokenResponse> => {
  const issued = await sequelize.transaction(async (transaction) => {
    const code = await AlexaAuthorizationCode.findOne({
      where: { code_hash: sha256Hex(codeValue) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (
      !code ||
      code.dataValues.used_at ||
      new Date(code.dataValues.expires_at).getTime() <= Date.now() ||
      code.dataValues.redirect_uri !== redirectUri
    ) {
      return { error: new AlexaTokenError(400, 'invalid_grant') };
    }

    // A presented code is single-use even when the family or entitlement check then fails.
    await code.update({ used_at: new Date() }, { transaction });

    const user = await User.findByPk(code.dataValues.user_id, { transaction });
    const familyGroupId = user?.dataValues.family_group_id;
    if (!user || familyGroupId === null || familyGroupId === undefined) {
      return { error: new AlexaTokenError(400, 'invalid_grant') };
    }

    try {
      await EntitlementsService.assertFeature(familyGroupId, user.dataValues.id, 'alexa');
    } catch (error) {
      if (error instanceof EntitlementsService.EntitlementRequiredError) {
        return { error: new AlexaTokenError(400, 'invalid_grant') };
      }
      throw error;
    }

    const now = new Date();
    const rawRefresh = randomSecret();
    const rawAccess = randomSecret();
    const refreshExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
    const accessExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_EXPIRES_IN_SECONDS * 1000);

    const existing = await AlexaLink.findOne({
      where: { user_id: user.dataValues.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    let linkId: number;
    if (existing) {
      await AlexaAccessToken.destroy({
        where: { alexa_link_id: existing.dataValues.id },
        transaction,
      });
      await existing.update(
        {
          refresh_token_hash: sha256Hex(rawRefresh),
          refresh_expires_at: refreshExpiresAt,
          revoked_at: null,
          linked_at: now,
          amazon_user_id: null,
        },
        { transaction }
      );
      linkId = existing.dataValues.id;
    } else {
      const created = await AlexaLink.create(
        {
          user_id: user.dataValues.id,
          refresh_token_hash: sha256Hex(rawRefresh),
          refresh_expires_at: refreshExpiresAt,
          revoked_at: null,
          amazon_user_id: null,
          linked_at: now,
        },
        { transaction }
      );
      linkId = created.dataValues.id;
    }

    await AlexaAccessToken.create(
      {
        alexa_link_id: linkId,
        token_hash: sha256Hex(rawAccess),
        expires_at: accessExpiresAt,
      },
      { transaction }
    );

    return {
      tokens: {
        access_token: rawAccess,
        token_type: 'Bearer' as const,
        expires_in: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
        refresh_token: rawRefresh,
      },
    };
  });

  if ('error' in issued) {
    throw issued.error;
  }
  return issued.tokens;
};

const issueRefreshToken = async (refreshToken: string): Promise<AlexaOAuthTokenResponse> => {
  return sequelize.transaction(async (transaction) => {
    const link = await AlexaLink.findOne({
      where: { refresh_token_hash: sha256Hex(refreshToken) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!link || !isActiveLink(link)) {
      throw new AlexaTokenError(400, 'invalid_grant');
    }

    const user = await User.findByPk(link.dataValues.user_id, { transaction });
    if (!user) {
      throw new AlexaTokenError(400, 'invalid_grant');
    }

    const now = new Date();
    const rawAccess = randomSecret();
    await link.update(
      { refresh_expires_at: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS) },
      { transaction }
    );
    await AlexaAccessToken.create(
      {
        alexa_link_id: link.dataValues.id,
        token_hash: sha256Hex(rawAccess),
        expires_at: new Date(now.getTime() + ACCESS_TOKEN_EXPIRES_IN_SECONDS * 1000),
      },
      { transaction }
    );

    return {
      access_token: rawAccess,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
      refresh_token: refreshToken,
    };
  });
};

export const grantAlexaTokens = async (body: unknown): Promise<AlexaOAuthTokenResponse> => {
  const userId = await identifyAlexaGrantUser(body);
  const enabled = await isFeatureEnabled(String(userId), FEATURE_FLAGS.alexaConnection);
  if (!enabled) {
    throw new AlexaTokenError(400, 'invalid_grant');
  }

  const request = readTokenRequest(body);
  if (request.grantType === 'authorization_code' && request.code && request.redirectUri) {
    return issueAuthorizationCode(request.code, request.redirectUri);
  }
  if (!request.refreshToken) {
    throw new AlexaTokenError(400, 'invalid_request');
  }
  return issueRefreshToken(request.refreshToken);
};

export const getAlexaLinkStatus = async (userId: number): Promise<AlexaLinkStatus> => {
  const link = await AlexaLink.findOne({ where: { user_id: userId } });
  if (!link || !isActiveLink(link)) {
    return { connected: false, connectedAt: null };
  }
  return {
    connected: true,
    connectedAt: toIso(link.dataValues.linked_at),
  };
};

export const disconnectAlexaLink = async (userId: number): Promise<void> => {
  const link = await AlexaLink.findOne({ where: { user_id: userId } });
  if (link) {
    await AlexaAccessToken.destroy({ where: { alexa_link_id: link.dataValues.id } });
    await link.update({ revoked_at: new Date() });
  }
  await AlexaAuthorizationCode.destroy({
    where: { user_id: userId, used_at: null },
  });
};
