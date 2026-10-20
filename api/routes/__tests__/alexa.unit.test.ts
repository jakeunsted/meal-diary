import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { FEATURE_FLAGS } from '@meal-diary/shared';

process.env.JWT_ACCESS_SECRET = 'unit-test-secret';
delete process.env.POSTHOG_KEY;

vi.mock('../../utils/posthog.ts', async () => {
  const actual = await vi.importActual<typeof import('../../utils/posthog.ts')>(
    '../../utils/posthog.ts'
  );
  return {
    ...actual,
    isFeatureEnabled: vi.fn(),
  };
});

vi.mock('../../services/alexaOAuth.service.ts', () => ({
  createAlexaAuthorization: vi.fn(),
  identifyAlexaGrantUser: vi.fn(),
  grantAlexaTokens: vi.fn(),
  getAlexaLinkStatus: vi.fn(),
  disconnectAlexaLink: vi.fn(),
  AlexaOAuthRequestError: class AlexaOAuthRequestError extends Error {},
  AlexaFamilyRequiredError: class AlexaFamilyRequiredError extends Error {},
  AlexaTokenError: class AlexaTokenError extends Error {},
}));

import { User } from '../../db/models/associations.ts';
import { isFeatureEnabled } from '../../utils/posthog.ts';
import {
  createAlexaAuthorization,
  disconnectAlexaLink,
  getAlexaLinkStatus,
} from '../../services/alexaOAuth.service.ts';
import alexaRoutes from '../alexa.routes.ts';

const app = express();
app.use(express.json());
app.use('/alexa', alexaRoutes);

const tokenFor = (userId: number) => jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET!);
const auth = { Authorization: `Bearer ${tokenFor(1)}` };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isFeatureEnabled).mockResolvedValue(true);
  vi.spyOn(User, 'findByPk').mockResolvedValue({
    dataValues: { id: 1, family_group_id: 1 },
  } as never);
});

describe('alexa routes feature flag', () => {
  it('returns 404 for link and authorize routes when the flag is off', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false);

    const getResponse = await request(app).get('/alexa/link').set(auth);
    const deleteResponse = await request(app).delete('/alexa/link').set(auth);
    const authorizeResponse = await request(app)
      .post('/alexa/oauth/authorize')
      .set(auth)
      .send({ responseType: 'code' });

    expect(getResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
    expect(authorizeResponse.status).toBe(404);
    expect(getResponse.body).toEqual({ message: 'Not found' });
    expect(isFeatureEnabled).toHaveBeenCalledWith('1', FEATURE_FLAGS.alexaConnection);
    expect(getAlexaLinkStatus).not.toHaveBeenCalled();
    expect(disconnectAlexaLink).not.toHaveBeenCalled();
    expect(createAlexaAuthorization).not.toHaveBeenCalled();
  });

  it('reads link status when the flag is on', async () => {
    vi.mocked(getAlexaLinkStatus).mockResolvedValue({
      connected: true,
      connectedAt: '2026-10-20T12:00:00.000Z',
    });

    const response = await request(app).get('/alexa/link').set(auth);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      connected: true,
      connectedAt: '2026-10-20T12:00:00.000Z',
    });
    expect(isFeatureEnabled).toHaveBeenCalledWith('1', FEATURE_FLAGS.alexaConnection);
  });
});
