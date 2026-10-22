import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURE_FLAGS } from '@meal-diary/shared';
import {
  AlexaAccessToken,
  AlexaLink,
  DailyMeal,
  FamilyGroup,
  MealDiary,
  Recipe,
  User,
} from '../../db/models/associations.ts';
import { isFeatureEnabled } from '../../utils/posthog.ts';
import { EntitlementRequiredError } from '../entitlements.service.ts';
import * as EntitlementsService from '../entitlements.service.ts';
import { getActiveMealSlots } from '../mealSlots.service.ts';
import { ALEXA_SPEECH } from '../alexaSpeech.service.ts';
import { fulfillAlexaSkill } from '../alexaSkill.service.ts';

vi.mock('../../utils/posthog.ts', async () => {
  const actual = await vi.importActual<typeof import('../../utils/posthog.ts')>(
    '../../utils/posthog.ts'
  );
  return {
    ...actual,
    isFeatureEnabled: vi.fn(),
  };
});

vi.mock('../mealSlots.service.ts', () => ({
  getActiveMealSlots: vi.fn(),
  buildDaySlotsForWeek: vi.fn(),
}));

const mealRequest = (accessToken?: string) => ({
  request: {
    type: 'IntentRequest',
    timestamp: '2026-10-18T12:00:00.000Z',
    intent: {
      name: 'GetDiaryIntent',
      slots: { day: { name: 'day', value: 'today' } },
    },
  },
  context: {
    System: {
      apiEndpoint: 'https://api.eu.amazonalexa.com',
      apiAccessToken: 'amazon-api-token',
      device: { deviceId: 'device-1' },
      user: accessToken ? { accessToken } : {},
    },
  },
  session: {
    user: accessToken ? { accessToken } : {},
  },
});

const speechText = (result: Awaited<ReturnType<typeof fulfillAlexaSkill>>): string | undefined =>
  result.body?.response.outputSpeech?.text;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(isFeatureEnabled).mockResolvedValue(true);
  vi.spyOn(EntitlementsService, 'assertFeature').mockResolvedValue({} as never);
  vi.spyOn(AlexaAccessToken, 'findOne').mockResolvedValue(null);
  vi.spyOn(AlexaLink, 'findByPk').mockResolvedValue(null);
  vi.spyOn(User, 'findByPk').mockResolvedValue(null);
  vi.spyOn(MealDiary, 'findOne').mockResolvedValue(null);
  vi.spyOn(DailyMeal, 'findOne').mockResolvedValue(null);
  vi.spyOn(Recipe, 'findAll').mockResolvedValue([]);
  vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue(null);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no fetch')));
});

const primeLinkedUser = (user: { id: number; familyGroupId: number | null }) => {
  vi.spyOn(AlexaAccessToken, 'findOne').mockResolvedValue({
    dataValues: {
      id: 1,
      alexa_link_id: 2,
      expires_at: new Date(Date.now() + 60_000),
    },
  } as never);
  vi.spyOn(AlexaLink, 'findByPk').mockResolvedValue({
    dataValues: { id: 2, user_id: user.id, revoked_at: null },
    update: vi.fn().mockResolvedValue(undefined),
  } as never);
  vi.spyOn(User, 'findByPk').mockResolvedValue({
    dataValues: { id: user.id, family_group_id: user.familyGroupId },
  } as never);
};

describe('alexaSkill.service', () => {
  it('returns a LinkAccount card when the token is missing and the flag is on', async () => {
    const result = await fulfillAlexaSkill(mealRequest());

    expect(result.httpStatus).toBe(200);
    expect(result.body).toEqual({
      version: '1.0',
      response: {
        outputSpeech: { type: 'PlainText', text: ALEXA_SPEECH.linkAccount },
        card: { type: 'LinkAccount' },
        shouldEndSession: true,
      },
    });
    expect(isFeatureEnabled).toHaveBeenCalledWith('alexa-skill', FEATURE_FLAGS.alexaConnection);
    expect(AlexaAccessToken.findOne).not.toHaveBeenCalled();
    expect(MealDiary.findOne).not.toHaveBeenCalled();
  });

  it('says the person needs a family and does not read meals', async () => {
    primeLinkedUser({ id: 9, familyGroupId: null });

    const result = await fulfillAlexaSkill(mealRequest('access-token'));

    expect(result.httpStatus).toBe(200);
    expect(speechText(result)).toBe(ALEXA_SPEECH.noFamily);
    expect(EntitlementsService.assertFeature).not.toHaveBeenCalled();
    expect(getActiveMealSlots).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('says Family Plus when the alexa entitlement has lapsed', async () => {
    primeLinkedUser({ id: 9, familyGroupId: 4 });
    vi.spyOn(EntitlementsService, 'assertFeature').mockRejectedValue(
      new EntitlementRequiredError('alexa', 'free')
    );

    const result = await fulfillAlexaSkill(mealRequest('access-token'));

    expect(speechText(result)).toBe(ALEXA_SPEECH.familyPlus);
    expect(EntitlementsService.assertFeature).toHaveBeenCalledWith(4, 9, 'alexa');
    expect(getActiveMealSlots).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('says the time zone could not be read and does not use the diary', async () => {
    primeLinkedUser({ id: 9, familyGroupId: 4 });

    const result = await fulfillAlexaSkill(mealRequest('access-token'));

    expect(speechText(result)).toBe(ALEXA_SPEECH.timezone);
    expect(fetch).toHaveBeenCalled();
    expect(getActiveMealSlots).not.toHaveBeenCalled();
    expect(MealDiary.findOne).not.toHaveBeenCalled();
  });

  it("speaks that Alexa is unavailable when the resolved user's flag is off", async () => {
    primeLinkedUser({ id: 9, familyGroupId: 4 });
    vi.mocked(isFeatureEnabled).mockResolvedValue(false);

    const result = await fulfillAlexaSkill(mealRequest('access-token'));

    expect(result.httpStatus).toBe(200);
    expect(speechText(result)).toBe("Meal Diary on Alexa isn't available.");
    expect(result.body?.response.card).toBeUndefined();
    expect(isFeatureEnabled).toHaveBeenCalledWith('9', FEATURE_FLAGS.alexaConnection);
    expect(EntitlementsService.assertFeature).not.toHaveBeenCalled();
    expect(getActiveMealSlots).not.toHaveBeenCalled();
    expect(MealDiary.findOne).not.toHaveBeenCalled();
  });

  it('returns an empty 404 when there is no Meal Diary user and the flag is off', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false);

    const result = await fulfillAlexaSkill(mealRequest());

    expect(result).toEqual({ httpStatus: 404, body: null });
    expect(isFeatureEnabled).toHaveBeenCalledWith('alexa-skill', FEATURE_FLAGS.alexaConnection);
    expect(MealDiary.findOne).not.toHaveBeenCalled();
  });
});
