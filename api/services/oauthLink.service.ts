import crypto from 'crypto';
import { Op } from 'sequelize';
import OAuthLinkChallenge from '../db/models/OAuthLinkChallenge.model.ts';

const LINK_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export interface OAuthLinkProfile {
  givenName?: string;
  familyName?: string;
  avatarUrl?: string;
}

export interface OAuthLinkChallengeInput {
  userId: number;
  provider: 'google' | 'apple';
  subject: string;
  email: string;
  profile: OAuthLinkProfile;
}

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const createOAuthLinkChallenge = async (input: OAuthLinkChallengeInput): Promise<string> => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  await OAuthLinkChallenge.destroy({
    where: {
      user_id: input.userId,
      used_at: null,
    },
  });
  await OAuthLinkChallenge.create({
    user_id: input.userId,
    token_hash: hashToken(rawToken),
    provider: input.provider,
    subject: input.subject,
    email: input.email.toLowerCase(),
    profile_json: JSON.stringify(input.profile),
    expires_at: new Date(Date.now() + LINK_CHALLENGE_TTL_MS),
  });
  return rawToken;
};

export const findActiveOAuthLinkChallenge = async (rawToken: string): Promise<OAuthLinkChallenge | null> => {
  if (!rawToken) {
    return null;
  }

  return OAuthLinkChallenge.findOne({
    where: {
      token_hash: hashToken(rawToken),
      used_at: null,
      expires_at: { [Op.gt]: new Date() },
    },
  });
};

export const markOAuthLinkChallengeUsed = async (id: number): Promise<void> => {
  await OAuthLinkChallenge.update({ used_at: new Date() }, { where: { id } });
};
